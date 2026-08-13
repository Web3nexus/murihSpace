<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Support staff roles
    |--------------------------------------------------------------------------
    |
    | Each role carries a default permission bundle. A staff member may
    | override their role's bundle with a custom "permissions" list; when that
    | list is null the role defaults apply.
    |
    */

    'roles' => [

        'support_agent' => [
            'ticket.view',
            'ticket.reply',
            'ticket.note',
            'ticket.create',
            'customer.summary.view',
            'help.article.view',
        ],

        'senior_agent' => [
            'ticket.view',
            'ticket.reply',
            'ticket.note',
            'ticket.create',
            'ticket.assign',
            'ticket.close',
            'ticket.escalate',
            'customer.summary.view',
            'customer.notes.create',
            'help.article.view',
        ],

        'support_manager' => [
            'ticket.view',
            'ticket.reply',
            'ticket.note',
            'ticket.create',
            'ticket.assign',
            'ticket.close',
            'ticket.escalate',
            'customer.summary.view',
            'customer.notes.create',
            'help.article.view',
            'refund.approve',
            'report.view',
            'agent.manage',
            'team.manage',
            'sla.manage',
            'automation.view',
            'automation.manage',
            'audit.view',
            'macro.manage',
            'settings.manage',
        ],

        'technical_support' => [
            'ticket.view',
            'ticket.reply',
            'ticket.note',
            'ticket.create',
            'ticket.escalate',
            'customer.summary.view',
            'help.article.view',
            'automation.view',
            'automation.manage',
            'integration.view',
        ],

        'billing_support' => [
            'ticket.view',
            'ticket.reply',
            'ticket.note',
            'ticket.create',
            'customer.summary.view',
            'help.article.view',
            'refund.request',
            'refund.approve',
            'report.view',
        ],

        'kyc_support' => [
            'ticket.view',
            'ticket.reply',
            'ticket.note',
            'ticket.create',
            'customer.summary.view',
            'help.article.view',
            'kyc.summary.view',
        ],

        'help_editor' => [
            'help.article.view',
            'help.article.create',
            'help.article.edit',
            'help.article.publish',
            'help.article.archive',
        ],

        'content_manager' => [
            'help.article.view',
            'help.article.create',
            'help.article.edit',
            'help.article.publish',
            'help.article.archive',
            'cms.view',
            'cms.edit',
            'cms.publish',
            'announcement.view',
            'announcement.manage',
        ],

        'crm_manager' => [
            'customer.summary.view',
            'customer.notes.create',
            'crm.view',
            'report.view',
            'ticket.view',
        ],
        'support_admin' => [],

    ],

    /*
    |--------------------------------------------------------------------------
    | SecureCRM section access
    |--------------------------------------------------------------------------
    |
    | Maps each dashboard section (route suffix) to the permission required to
    | view it. Sections omitted here are open to any authenticated staff member.
    |
    */

    'section_permissions' => [
        'tickets' => 'ticket.view',
        'customers' => 'customer.summary.view',
        'crm' => 'crm.view',
        'help' => 'help.article.view',
        'cms' => 'cms.view',
        'announcements' => 'announcement.view',
        'knowledge' => 'help.article.view',
        'reports' => 'report.view',
        'agents' => 'agent.manage',
        'teams' => 'team.manage',
        'slas' => 'sla.manage',
        'macros' => 'macro.manage',
        'automation' => 'automation.view',
        'integrations' => 'integration.view',
        'audit' => 'audit.view',
        'settings' => 'settings.manage',
    ],

];
