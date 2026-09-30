<?php

namespace App\Services;

use App\Models\ModerationRule;
use App\Models\ModerationRuleLog;
use App\Models\Report;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Evaluates content against the stored detection rules.
 *
 * Per DEC-013 this only ever queues. It never removes, hides, suspends or bans:
 * a match becomes a `Report` in the moderation queue plus a rule log, and the
 * moderation team is notified. Anything beyond that is a decision for a person.
 *
 * The content-type extension is used to decide the "applies_to" filter, and the
 * monitor is deliberately called with plain strings rather than models so it
 * cannot accidentally reach through an Eloquent object to author relationships
 * it has no business touching.
 */
class ContentMonitor
{
    public function __construct(private readonly AdminAlertService $alerts) {}

    /**
     * Scan one piece of content.
     *
     * @return Report[] the reports created by this scan
     */
    public function scan(string $contentType, int $contentId, ?int $authorId, string $text): array
    {
        $text = trim($text);

        if ($text === '') {
            return [];
        }

        $rules = ModerationRule::where('enabled', true)->get()
            ->filter(fn (ModerationRule $rule) => $this->appliesTo($rule, $contentType));

        if ($rules->isEmpty()) {
            return [];
        }

        $created = [];

        foreach ($rules as $rule) {
            $pattern = $this->firstMatch($rule, $text);

            if ($pattern === null) {
                continue;
            }

            $created[] = $this->flag($rule, $contentType, $contentId, $authorId, $text, $pattern);
        }

        return array_values(array_filter($created));
    }

    private function appliesTo(ModerationRule $rule, string $contentType): bool
    {
        $applies = $rule->applies_to;

        if (! is_array($applies) || $applies === []) {
            return true;
        }

        return in_array($contentType, $applies, true);
    }

    /**
     * The first pattern of this rule present in the text, or null.
     */
    private function firstMatch(ModerationRule $rule, string $text): ?string
    {
        foreach ((array) $rule->patterns as $pattern) {
            $pattern = (string) $pattern;

            if ($pattern === '') {
                continue;
            }

            $hit = match ($rule->match_type) {
                'regex' => $this->regexMatch($pattern, $text),
                // A phrase is a keyword that may contain spaces, so both are
                // matched as a literal substring, case-insensitively.
                default => mb_stripos($text, $pattern) !== false ? $pattern : null,
            };

            if ($hit !== null) {
                return $hit;
            }
        }

        return null;
    }

    /**
     * A rule that cannot compile is a configuration error, not a content
     * verdict. Swallowing it and reporting "no match" would let a broken
     * pattern look like a clean pass, so it is logged loudly and the rule is
     * skipped.
     */
    private function regexMatch(string $pattern, string $text): ?string
    {
        $delimited = '/'.str_replace('/', '\/', $pattern).'/iu';

        $result = @preg_match($delimited, $text);

        if ($result === false) {
            Log::error('Moderation rule has an invalid regular expression.', [
                'pattern' => $pattern,
            ]);

            return null;
        }

        return $result === 1 ? $pattern : null;
    }

    private function flag(
        ModerationRule $rule,
        string $contentType,
        int $contentId,
        ?int $authorId,
        string $text,
        string $pattern,
    ): ?Report {
        // One report per (rule, content) is enough: a second scan of an edited
        // post should not multiply the queue with duplicates of one finding.
        // Both open states count — a member report on the same content is still
        // `pending`, and this rule's own earlier finding is `flagged`.
        $existing = Report::where('reported_type', $contentType)
            ->where('reported_id', $contentId)
            ->whereIn('status', ['pending', 'flagged'])
            ->where('details', 'like', '%[rule:'.$rule->id.']%')
            ->exists();

        if ($existing) {
            return null;
        }

        return DB::transaction(function () use ($rule, $contentType, $contentId, $authorId, $text, $pattern) {
            $report = Report::create([
                // No reporter: this finding came from a rule, not a person. The
                // author of the content is recorded on the rule log instead.
                'reporter_id' => null,
                'reported_type' => $contentType,
                'reported_id' => $contentId,
                'reason' => $rule->category,
                'details' => sprintf(
                    'Automatically flagged by rule "%s" (severity: %s) matching "%s". [rule:%d]',
                    $rule->name,
                    $rule->severity,
                    $pattern,
                    $rule->id
                ),
                'status' => 'flagged',
                'flagged_by' => null,
                'flagged_at' => now(),
                'flag_count' => 1,
            ]);

            ModerationRuleLog::create([
                'rule_id' => $rule->id,
                'report_id' => $report->id,
                'content_type' => $contentType,
                'content_id' => $contentId,
                'author_id' => $authorId,
                'matched_pattern' => $pattern,
                'snippet' => $this->snippet($text, $pattern),
                'action' => ModerationRuleLog::ACTION,
            ]);

            $rule->recordMatch();

            $this->notifyModerators($rule, $contentType, $contentId, $report);

            return $report;
        });
    }

    /**
     * A short excerpt around the match, so a moderator can see why the rule
     * fired without opening the content and without the excerpt itself becoming
     * a redistribution of the offending text.
     */
    private function snippet(string $text, string $pattern): string
    {
        $position = mb_stripos($text, $pattern);

        if ($position === false) {
            return mb_substr($text, 0, 200);
        }

        $start = max(0, $position - 60);

        return trim(mb_substr($text, $start, 180));
    }

    private function notifyModerators(ModerationRule $rule, string $contentType, int $contentId, Report $report): void
    {
        try {
            $this->alerts->dispatch([
                'event_type' => 'moderation.auto_flag',
                'severity' => $this->severityFor($rule->severity),
                'title' => 'Content automatically flagged for review',
                'description' => sprintf(
                    'Rule "%s" (category %s, severity %s) matched a %s. Report #%d is waiting in the moderation queue.',
                    $rule->name,
                    $rule->category,
                    $rule->severity,
                    $contentType,
                    $report->id
                ),
                'affected_service' => 'moderation',
                'reference' => 'report:'.$report->id,
                'metadata' => [
                    'report_id' => $report->id,
                    'rule_id' => $rule->id,
                    'rule_name' => $rule->name,
                    'content_type' => $contentType,
                    'content_id' => $contentId,
                ],
            ]);
        } catch (\Throwable $e) {
            // The report row is the durable record; a failed alert must not undo
            // the finding, and must not roll back the queue entry either.
            report($e);
        }
    }

    /**
     * Rule severity mapped onto the alert severities the alerting channel
     * already understands, so an auto-flag is routed like any other alert
     * rather than inventing a parallel scale.
     */
    private function severityFor(string $ruleSeverity): string
    {
        return match ($ruleSeverity) {
            'high' => 'critical',
            'low' => 'info',
            default => 'warning',
        };
    }
}
