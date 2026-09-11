<?php

namespace App\Console\Commands;

use App\Services\Payment\LiveExchangeRateService;
use Illuminate\Console\Command;

class UpdateExchangeRatesCommand extends Command
{
    protected $signature = 'currency:update-rates';
    protected $description = 'Sync live market exchange rates against USD from external forex feeds';

    public function handle(LiveExchangeRateService $rateService): int
    {
        $this->info('Fetching real-time exchange rates against USD...');

        $rates = $rateService->syncRates();

        $this->table(
            ['Currency', 'Rate per 1 USD', 'Inverse (1 Currency in USD)'],
            collect($rates)->map(fn ($rate, $code) => [
                $code,
                number_format((float) $rate, 4),
                $rate > 0 ? '$' . number_format(1.0 / (float) $rate, 6) : 'N/A',
            ])->toArray()
        );

        $this->info('Exchange rates updated successfully.');
        return self::SUCCESS;
    }
}
