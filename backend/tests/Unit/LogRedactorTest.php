<?php

namespace Tests\Unit;

use App\Logging\RedactSensitiveLogs;
use App\Support\LogRedactor;
use DateTimeImmutable;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Log\Logger;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Monolog\Logger as Monolog;
use Monolog\LogRecord;
use PHPUnit\Framework\TestCase;

class LogRedactorTest extends TestCase
{
    public function test_masks_sensitive_keys_inside_nested_arrays(): void
    {
        $input = [
            'user' => ['password' => 'x', 'mobile_number' => '+254700000000'],
            'items' => [['token' => 'abc', 'cvv' => '123']],
        ];

        $out = LogRedactor::redact($input);

        $this->assertSame('***', $out['user']['password']);
        $this->assertSame('***0000', $out['user']['mobile_number']);
        $this->assertSame('***', $out['items'][0]['token']);
        $this->assertSame('***', $out['items'][0]['cvv']);
    }

    public function test_masks_card_number_keeping_last_four_and_whole_values_for_others(): void
    {
        $out = LogRedactor::redact([
            'card_number' => '4242424242424242',
            'otp' => '998877',
            'email' => 'jane@example.com',
            'authorization' => 'Bearer abc.def',
        ]);

        $this->assertSame('***4242', $out['card_number']);
        $this->assertSame('***', $out['otp']);
        $this->assertSame('***', $out['email']);
        $this->assertSame('***', $out['authorization']);
    }

    public function test_leaves_unrelated_keys_intact(): void
    {
        $input = [
            'status_code' => 200,
            'message' => 'ok',
            'order_id' => 42,
            'amount' => '10.00',
            'nested' => ['currency' => 'KES', 'items' => [1, 2]],
        ];

        $this->assertSame($input, LogRedactor::redact($input));
    }

    public function test_matches_key_substrings_and_ignores_null_values(): void
    {
        $out = LogRedactor::redact([
            'X-Api-Key' => 'k-1',
            'client_secret' => 's-1',
            'reset_token' => 't-1',
            'new_password_confirmation' => 'p-1',
            'pin' => null,
        ]);

        $this->assertSame('***', $out['X-Api-Key']);
        $this->assertSame('***', $out['client_secret']);
        $this->assertSame('***', $out['reset_token']);
        $this->assertSame('***', $out['new_password_confirmation']);
        $this->assertNull($out['pin']);
    }

    public function test_masks_arrayable_objects_and_sensitive_arrays(): void
    {
        $object = new class implements Arrayable
        {
            public function toArray(): array
            {
                return ['access_token' => 'abc', 'id' => 7];
            }
        };

        $out = LogRedactor::redact(['payload' => $object, 'token' => ['a', 'b']]);

        $this->assertSame(['access_token' => '***', 'id' => 7], $out['payload']);
        $this->assertSame('***', $out['token']);
    }

    public function test_scrubs_bearer_tokens_inside_strings(): void
    {
        $out = LogRedactor::redact([
            'header' => 'Authorization: Bearer eyJhbGciOi.payload-part.sig=',
            'note' => 'no credentials here',
        ]);

        $this->assertSame('Authorization: Bearer ***', $out['header']);
        $this->assertSame('no credentials here', $out['note']);
        $this->assertSame('retry with Bearer ***', LogRedactor::scrubBearer('retry with bearer abc123'));
    }

    public function test_masks_codes_in_free_text_and_phone_numbers(): void
    {
        $this->assertSame(
            'Your login verification code is ***.',
            LogRedactor::maskCodes('Your login verification code is 123456.'),
        );
        $this->assertSame('***0000', LogRedactor::maskPhone('+254700000000'));
    }

    public function test_processor_redacts_message_context_and_extra(): void
    {
        $handler = new TestHandler;
        $monolog = new Monolog('test', [$handler]);
        $logger = new Logger($monolog);

        (new RedactSensitiveLogs)($logger);

        $logger->info('Bearer abc.def used', [
            'user' => ['password' => 'x', 'mobile_number' => '+254700000000'],
            'items' => [['token' => 'abc', 'cvv' => '123']],
            'order_id' => 9,
        ]);

        $record = $handler->getRecords()[0];

        $this->assertSame('Bearer *** used', $record->message);
        $this->assertSame('***', $record->context['user']['password']);
        $this->assertSame('***0000', $record->context['user']['mobile_number']);
        $this->assertSame('***', $record->context['items'][0]['token']);
        $this->assertSame('***', $record->context['items'][0]['cvv']);
        $this->assertSame(9, $record->context['order_id']);
    }

    public function test_process_record_redacts_extra(): void
    {
        $record = new LogRecord(
            datetime: new DateTimeImmutable,
            channel: 'test',
            level: Level::Info,
            message: 'extra check',
            context: [],
            extra: ['authorization' => 'Bearer abc', 'request_id' => 'r-1'],
        );

        $out = LogRedactor::processRecord($record);

        $this->assertSame(['authorization' => '***', 'request_id' => 'r-1'], $out->extra);
    }
}
