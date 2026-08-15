<?php

namespace App\Services;

/**
 * Client for the Marketing / CRM / Support backend.
 * Owns: support tickets, announcements, help articles, CRM records, CMS content.
 */
class MarketingApiClient extends ApiClient
{
    protected function baseUrl(): string
    {
        return config('api.marketing_base_url');
    }

    protected function serviceToken(): string
    {
        return config('api.marketing_service_token');
    }

    /**
     * Options for customer ticket calls (includes X-Internal-Token and X-Customer-Email)
     */
    private function ticketHeaders(string $customerEmail): array
    {
        return [
            'headers' => [
                'X-Internal-Token' => $this->serviceToken(),
                'X-Customer-Email' => $customerEmail,
            ],
        ];
    }

    // -----------------------------------------------------------------------
    // Help Center & Knowledge Base (Public)
    // -----------------------------------------------------------------------

    public function getHelpCategories(): array
    {
        return $this->get('public/help/categories');
    }

    public function getHelpArticles(array $query = []): array
    {
        return $this->get('public/help/articles', $query);
    }

    public function getHelpArticle(string $slug): array
    {
        return $this->get("public/help/articles/{$slug}");
    }

    public function searchHelp(string $query): array
    {
        return $this->get('public/help/search', ['q' => $query]);
    }

    public function submitArticleFeedback(string $slug, array $data): array
    {
        return $this->post("public/help/articles/{$slug}/feedback", $data);
    }

    // -----------------------------------------------------------------------
    // CMS & Announcements (Public)
    // -----------------------------------------------------------------------

    public function getAnnouncements(): array
    {
        return $this->get('public/announcements');
    }

    public function getCmsSection(string $section): array
    {
        return $this->get("public/cms/{$section}");
    }

    public function getCmsItem(string $section, string $slug): array
    {
        return $this->get("public/cms/{$section}/{$slug}");
    }

    // -----------------------------------------------------------------------
    // Customer Tickets (Authenticated via user email)
    // -----------------------------------------------------------------------

    public function getTicketCategories(string $customerEmail): array
    {
        return $this->get('customer/tickets/categories', [], $this->ticketHeaders($customerEmail));
    }

    public function getTickets(string $customerEmail, array $query = []): array
    {
        return $this->get('customer/tickets', $query, $this->ticketHeaders($customerEmail));
    }

    public function createTicket(string $customerEmail, array $data): array
    {
        return $this->post('customer/tickets', $data, $this->ticketHeaders($customerEmail));
    }

    public function getTicket(string $customerEmail, string $ticketId): array
    {
        return $this->get("customer/tickets/{$ticketId}", [], $this->ticketHeaders($customerEmail));
    }

    public function replyTicket(string $customerEmail, string $ticketId, array $data): array
    {
        return $this->post("customer/tickets/{$ticketId}/reply", $data, $this->ticketHeaders($customerEmail));
    }

    public function updateTicketStatus(string $customerEmail, string $ticketId, array $data): array
    {
        return $this->post("customer/tickets/{$ticketId}/status", $data, $this->ticketHeaders($customerEmail));
    }

    public function rateTicket(string $customerEmail, string $ticketId, array $data): array
    {
        return $this->post("customer/tickets/{$ticketId}/rate", $data, $this->ticketHeaders($customerEmail));
    }

    // -----------------------------------------------------------------------
    // Health check
    // -----------------------------------------------------------------------

    public function health(): array
    {
        return $this->get('public/announcements');
    }
}
