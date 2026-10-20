<?php

namespace App\Services\Reporting;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sums real ad_metrics rows for campaign, ad group or ad lists in the Ads
 * Manager. Entities without delivery rows get zero totals; nothing is estimated.
 */
class AdMetricsAggregator
{
    public const LEVEL_CAMPAIGN = 'campaign';
    public const LEVEL_AD_GROUP = 'ad_group';
    public const LEVEL_AD = 'ad';

    /**
     * Optional date-range query parameters shared by the list endpoints.
     *
     * @return array<string, string>
     */
    public static function rangeRules(): array
    {
        return [
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
        ];
    }

    /**
     * Clamp the requested page size so list calls stay bounded.
     */
    public static function perPage(Request $request, int $default = 20): int
    {
        return min(max((int) $request->query('per_page', $default), 1), 100);
    }

    /**
     * Attach a `totals` object to every item on the current page.
     */
    public function attach(LengthAwarePaginator $page, string $level, ?string $startDate = null, ?string $endDate = null): LengthAwarePaginator
    {
        $ids = $page->getCollection()->pluck('id')->all();
        $totals = $this->totals($level, $ids, $startDate, $endDate);

        $page->getCollection()->transform(function ($model) use ($totals) {
            $row = $totals->get($model->id);
            $model->setAttribute('totals', [
                'impressions' => (int) ($row->impressions ?? 0),
                'clicks' => (int) ($row->clicks ?? 0),
                'spend' => (int) ($row->spend ?? 0), // minor units, same as ad_metrics.spend
                'conversions' => (int) ($row->conversions ?? 0),
                'conversion_value' => (int) ($row->conversion_value ?? 0),
            ]);

            return $model;
        });

        return $page;
    }

    /**
     * @param  array<int>  $ids
     * @return \Illuminate\Support\Collection<int|string, object>
     */
    public function totals(string $level, array $ids, ?string $startDate = null, ?string $endDate = null)
    {
        if (empty($ids)) {
            return collect();
        }

        $groupColumn = match ($level) {
            self::LEVEL_CAMPAIGN => 'ad_groups.campaign_id',
            self::LEVEL_AD_GROUP => 'ads.ad_group_id',
            self::LEVEL_AD => 'ad_metrics.ad_id',
        };

        return DB::table('ad_metrics')
            ->join('ads', 'ad_metrics.ad_id', '=', 'ads.id')
            ->join('ad_groups', 'ads.ad_group_id', '=', 'ad_groups.id')
            ->whereIn($groupColumn, $ids)
            ->when($startDate, fn ($q) => $q->where('ad_metrics.date', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->where('ad_metrics.date', '<=', $endDate))
            ->groupBy($groupColumn)
            ->selectRaw("{$groupColumn} as entity_id, SUM(ad_metrics.impressions) as impressions, SUM(ad_metrics.clicks) as clicks, SUM(ad_metrics.spend) as spend, SUM(ad_metrics.conversions) as conversions, SUM(ad_metrics.conversion_value) as conversion_value")
            ->get()
            ->keyBy('entity_id');
    }
}
