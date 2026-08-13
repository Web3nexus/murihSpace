<?php

namespace App\Services;

use App\Models\SlaPolicy;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Working-time arithmetic for SLA clocks. Determines how many seconds of a
 * policy's countable time elapse between two datetimes, honouring business
 * hours, weekend and holiday settings.
 */
class BusinessTime
{
    public static function secondsBetween(CarbonInterface $start, CarbonInterface $end, SlaPolicy $policy): int
    {
        if ($end->lessThanOrEqualTo($start)) {
            return 0;
        }

        [$open, $close] = self::window($policy);

        $cursor = $start->copy()->startOfDay();
        $endDay = $end->copy()->startOfDay();
        $total = 0;

        while ($cursor->lessThanOrEqualTo($endDay)) {
            if (self::isWorkday($cursor, $policy)) {
                $dayStart = $cursor->copy();
                $dayEnd = $cursor->copy()->endOfDay();

                $segmentStart = $start->greaterThan($dayStart) ? $start : $dayStart;
                $segmentEnd = $end->lessThan($dayEnd) ? $end : $dayEnd;

                if ($open !== null && $close !== null) {
                    $windowStart = $cursor->copy()->setTime($open->hour, $open->minute, $open->second);
                    $windowEnd = $cursor->copy()->setTime($close->hour, $close->minute, $close->second);
                    $segmentStart = $segmentStart->greaterThan($windowStart) ? $segmentStart : $windowStart;
                    $segmentEnd = $segmentEnd->lessThan($windowEnd) ? $segmentEnd : $windowEnd;
                }

                if ($segmentEnd->greaterThan($segmentStart)) {
                    $total += abs($segmentEnd->diffInSeconds($segmentStart));
                }
            }

            $cursor = $cursor->addDay();
        }

        return max(0, (int) $total);
    }

    /**
     * True when the given day counts toward the policy's SLA clock.
     */
    public static function isWorkday(CarbonInterface $day, SlaPolicy $policy): bool
    {
        if ($policy->holidays && in_array($day->format('Y-m-d'), $policy->holidayDates(), true)) {
            return false;
        }

        if (! $policy->weekends && $day->isWeekend()) {
            return false;
        }

        return true;
    }

    /**
     * Business-hours window (only honoured when business_hours is enabled).
     *
     * @return array{0: ?CarbonInterface, 1: ?CarbonInterface}
     */
    protected static function window(SlaPolicy $policy): array
    {
        if (! $policy->business_hours) {
            return [null, null];
        }

        $hours = (array) config('support.sla.business_hours', ['start' => '09:00', 'end' => '17:00', 'timezone' => 'UTC']);
        $tz = $hours['timezone'] ?? 'UTC';

        return [
            Carbon::parse($hours['start'] ?? '09:00', $tz),
            Carbon::parse($hours['end'] ?? '17:00', $tz),
        ];
    }
}
