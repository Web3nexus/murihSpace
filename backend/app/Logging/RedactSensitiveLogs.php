<?php

namespace App\Logging;

use App\Support\LogRedactor;
use Illuminate\Log\Logger;
use Monolog\LogRecord;

/**
 * Logging "tap": adds the LogRedactor processor to every configured channel.
 */
final class RedactSensitiveLogs
{
    public function __invoke(Logger $logger): void
    {
        $logger->getLogger()->pushProcessor(
            static fn (LogRecord $record): LogRecord => LogRedactor::processRecord($record)
        );
    }
}
