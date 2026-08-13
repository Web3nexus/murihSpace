<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use Illuminate\View\View;

class SecureCrmSectionController extends Controller
{
    public function __invoke(string $section): View
    {
        $titles = [
            'tickets' => 'Tickets',
            'customers' => 'Customers',
            'crm' => 'CRM',
            'help' => 'Help Center',
            'cms' => 'Website CMS',
            'announcements' => 'Announcements',
            'knowledge' => 'Knowledge Base',
            'reports' => 'Reports',
            'agents' => 'Agents',
            'teams' => 'Teams',
            'slas' => 'SLAs',
            'macros' => 'Macros',
            'automation' => 'Automation',
            'integrations' => 'Integrations',
            'audit' => 'Audit Logs',
            'settings' => 'Settings',
        ];

        abort_unless(array_key_exists($section, $titles), 404);

        $title = $titles[$section];

        return view('securecrm.section', [
            'title' => $title,
            'description' => $this->descriptionFor($section),
            'route' => "securecrm.{$section}",
        ]);
    }

    protected function descriptionFor(string $section): string
    {
        return match ($section) {
            'tickets' => 'Manage help requests from all channels, assign to agents and track resolution.',
            'customers' => 'Customer profiles, contexts and history across MurihSpace.',
            'crm' => 'Relationships, segments and lifecycle management.',
            'help' => 'Create and manage public help articles, categories and search.',
            'cms' => 'Edit website pages, sections and content blocks.',
            'announcements' => 'Send announcements to the community.',
            'knowledge' => 'Internal knowledge base for the support team.',
            'reports' => 'Performance, SLAs and volume reports.',
            'agents' => 'Manage support agents and queue load.',
            'teams' => 'Organise agents into support teams.',
            'slas' => 'Define and track service level agreements.',
            'macros' => 'Reusable reply templates for common replies.',
            'automation' => 'Automate repetitive support workflows.',
            'integrations' => 'Connect external tools and services.',
            'audit' => 'A trail of every staff action in SecureCRM.',
            'settings' => 'Global SecureCRM configuration.',
            default => 'This section is part of SecureCRM.',
        };
    }
}
