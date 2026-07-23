<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiReadyTest extends TestCase
{
    /**
     * Test the API ready endpoint returns the version and standard response envelope.
     */
    public function test_api_ready_endpoint_works(): void
    {
        $response = $this->getJson('/api/v1/ready');

        $response->assertStatus(200);

        // Assert response header has X-Request-ID
        $response->assertHeader('X-Request-ID');

        // Assert envelope structure
        $response->assertJsonStructure([
            'success',
            'request_id',
            'data' => [
                'status',
                'api_version',
                'services' => [
                    'database'
                ]
            ],
            'message',
            'errors'
        ]);

        $this->assertTrue($response->json('success'));
        $this->assertEquals('v1', $response->json('data.api_version'));
        $this->assertEquals('connected', $response->json('data.services.database'));
    }

    /**
     * Test custom exception handler returns formatted envelope.
     */
    public function test_custom_exception_handler_returns_formatted_envelope(): void
    {
        $response = $this->getJson('/api/v1/non-existent-route');

        $response->assertStatus(404);
        $response->assertHeader('X-Request-ID');
        $response->assertJsonStructure([
            'success',
            'request_id',
            'data',
            'message',
            'errors'
        ]);

        $this->assertFalse($response->json('success'));
        $this->assertNull($response->json('data'));
    }
}
