<?php

namespace App\Enums;

enum AdminNotificationCategory: string
{
    case NewUserRegistration = 'new_user_registration';
    case KycRequest = 'kyc_request';
    case AccountUpgradeRequest = 'account_upgrade_request';
    case DepositRequest = 'deposit_request';
    case WithdrawalRequest = 'withdrawal_request';
    case PaymentIssues = 'payment_issues';
    case SystemAlerts = 'system_alerts';
    case SecurityAlerts = 'security_alerts';
    case SupportRequests = 'support_requests';
    case ModerationEvents = 'moderation_events';
    case InfrastructureNotifications = 'infrastructure_notifications';

    public function label(): string
    {
        return match ($this) {
            self::NewUserRegistration => 'New User Registration',
            self::KycRequest => 'KYC Request',
            self::AccountUpgradeRequest => 'Account Upgrade Request',
            self::DepositRequest => 'Deposit Request',
            self::WithdrawalRequest => 'Withdrawal Request',
            self::PaymentIssues => 'Payment Issues',
            self::SystemAlerts => 'System Alerts',
            self::SecurityAlerts => 'Security Alerts',
            self::SupportRequests => 'Support Requests',
            self::ModerationEvents => 'Moderation Events',
            self::InfrastructureNotifications => 'Infrastructure/System Notifications',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::NewUserRegistration => 'Alerts when new users complete identity registration on the platform.',
            self::KycRequest => 'Submissions requiring government ID or proof of address verification.',
            self::AccountUpgradeRequest => 'Applications for Creator or Vendor status awaiting approval.',
            self::DepositRequest => 'Inbound wallet funding, high-value deposits, and top-up verifications.',
            self::WithdrawalRequest => 'Outbound payout requests and settlement requests awaiting disbursement.',
            self::PaymentIssues => 'Gateway errors, chargebacks, webhook failures, and failed transactions.',
            self::SystemAlerts => 'System anomalies, high error rates, and degraded service states.',
            self::SecurityAlerts => 'Suspicious sign-in attempts, brute-force detections, and authorization alerts.',
            self::SupportRequests => 'Customer disputes, escalated tickets, and priority help desk messages.',
            self::ModerationEvents => 'User reports, flag thresholds, and automated content moderation triggers.',
            self::InfrastructureNotifications => 'Queue backlogs, database health, disk utilization, and worker restarts.',
        };
    }

    /**
     * The admin permissions that grant access to this notification category.
     * Empty array means only Super Admin or unrestricted admin can view.
     *
     * @return array<int, string>
     */
    public function requiredPermissions(): array
    {
        return match ($this) {
            self::NewUserRegistration => [AdminPermission::Users->value],
            self::KycRequest => [AdminPermission::Kyc->value],
            self::AccountUpgradeRequest => [AdminPermission::Approvals->value],
            self::DepositRequest => [AdminPermission::Wallets->value, AdminPermission::Accounting->value],
            self::WithdrawalRequest => [AdminPermission::Payouts->value, AdminPermission::Wallets->value],
            self::PaymentIssues => [AdminPermission::Wallets->value, AdminPermission::Payouts->value, AdminPermission::Accounting->value],
            self::SystemAlerts => [AdminPermission::Settings->value],
            self::SecurityAlerts => [AdminPermission::Settings->value, AdminPermission::Users->value, AdminPermission::Warnings->value],
            self::SupportRequests => [AdminPermission::Support->value],
            self::ModerationEvents => [AdminPermission::Content->value, AdminPermission::Warnings->value],
            self::InfrastructureNotifications => [AdminPermission::Settings->value],
        };
    }

    /**
     * @return array<string, array{label: string, description: string, permissions: array<int, string>}>
     */
    public static function metadata(): array
    {
        $out = [];
        foreach (self::cases() as $case) {
            $out[$case->value] = [
                'key' => $case->value,
                'label' => $case->label(),
                'description' => $case->description(),
                'permissions' => $case->requiredPermissions(),
            ];
        }
        return $out;
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
