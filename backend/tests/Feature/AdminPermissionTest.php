<?php

namespace Tests\Feature;

use App\Enums\AdminPermission;
use App\Enums\AdminRole;
use App\Models\User;
use App\Support\AdminPermissionMatrix;
use App\Support\AdminSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Guards the administration surface against the class of defect recorded as
 * SEC-001: an admin route reachable by any administrator because it never
 * declared a permission.
 */
class AdminPermissionTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    /**
     * Administration routes that declare no permission, because none of them
     * carries privileged authority. Every other route under
     * /api/v1/securegate must name the permission it needs.
     *
     * The list is deliberately short and each entry is categorised, because
     * putting something here is a deliberate widening of the surface.
     */
    private const EXEMPT_ROUTES = [
        // Read-only, no authority: the overview counts a role is entitled to see.
        'api/v1/securegate/dashboard',
        // Read-only, no authority: a client must be able to read its own
        // permissions to render correct navigation, without holding `admins`.
        'api/v1/securegate/me',

        // The administration credential routes. Not administration *operations*.
        // Unauthenticated by necessity — they sit in front of auth:sanctum, and
        // a correct password alone buys nothing from them, since both return a
        // challenge rather than a session.
        'api/v1/securegate/auth/login',
        'api/v1/securegate/auth/2fa/verify',
        // Revokes the caller's own session. No role check can meaningfully
        // restrict who may end their own access.
        'api/v1/securegate/auth/logout',

        // First-time two-factor setup, and nothing else. These carry no
        // authority: they are gated on an IP-bound, single-use challenge that
        // only exists because /auth/login already accepted the password, and
        // they can only write a *first* factor — start refuses outright once one
        // is confirmed, so they cannot be used to replace a live second factor
        // on the strength of a password. Requiring a permission would make the
        // control unbootable: a brand-new administrator holds no permissions,
        // which is exactly the account that cannot enrol otherwise.
        'api/v1/securegate/auth/2fa/enroll/start',
        'api/v1/securegate/auth/2fa/enroll/confirm',

        // Admin-isolated notifications (Section 17 & 18). Authorization is
        // per-category and happens in AdminNotificationService::queryFor, which
        // intersects the requested categories with the permissions the caller
        // actually holds and returns an empty result set otherwise. A single
        // route-level permission cannot express "any of kyc, payouts, disputes,
        // trust & safety" without either over-granting or excluding a role that
        // legitimately owns one of them, so the check lives in the query.
        'api/v1/securegate/notifications',
        'api/v1/securegate/notifications/read-all',
        'api/v1/securegate/notifications/{id}/read',
        'api/v1/securegate/notifications/preferences',
    ];

    /**
     * Authenticate with an administration session.
     *
     * IsAdmin requires the admin:mfa ability, so a test that wants to reach a
     * route has to present a session of the kind AdminAuthController issues.
     * Sanctum::actingAs() with no abilities would model a consumer token and be
     * refused at the door — which is the behaviour SEC-003 added, and the tests
     * for it live in AdminAuthTest.
     */
    private function signIn(User $user, array $abilities = ['*', AdminSession::ABILITY_MFA]): static
    {
        return $this->actAsSession($user, $abilities);
    }

    private function admin(?AdminRole $role, array $permissions = []): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => $role?->value,
            'admin_permissions' => $permissions,
        ]);
    }

    /**
     * Every administration route must declare the permission it needs, so that a
     * newly added endpoint cannot silently be opened to all administrators.
     */
    public function test_every_securegate_route_declares_a_permission(): void
    {
        $unguarded = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();

            if (! str_starts_with($uri, 'api/v1/securegate')) {
                continue;
            }

            if (in_array($uri, self::EXEMPT_ROUTES, true)) {
                continue;
            }

            $declared = collect($route->gatherMiddleware())
                ->filter(fn (string $m) => str_starts_with($m, 'admin.permission'));

            if ($declared->isEmpty()) {
                $unguarded[] = implode('|', $route->methods()).' '.$uri;
            }

            foreach ($declared as $middleware) {
                $permission = str($middleware)->after(':')->toString();

                $this->assertNotNull(
                    AdminPermission::tryFrom($permission),
                    "Route [$uri] declares unknown admin permission [$permission]."
                );
            }
        }

        $this->assertSame(
            [],
            $unguarded,
            'These administration routes declare no permission and are reachable by every '
            ."administrator regardless of role:\n".implode("\n", $unguarded)
        );
    }

    /**
     * §21: a Support Admin must not automatically gain withdrawal management.
     */
    public function test_support_admin_cannot_reach_financial_endpoints(): void
    {
        $this->signIn($this->admin(AdminRole::SupportAdmin));

        foreach ([
            ['get', '/api/v1/securegate/withdrawals'],
            ['get', '/api/v1/securegate/wallets'],
            ['get', '/api/v1/securegate/accounting/overview'],
            ['post', '/api/v1/securegate/escrow/1/release'],
            ['post', '/api/v1/securegate/escrow/1/refund'],
            ['get', '/api/v1/securegate/tax/summary'],
            ['get', '/api/v1/securegate/gift-payouts'],
        ] as [$verb, $uri]) {
            $this->json($verb, $uri)->assertForbidden();
        }
    }

    /**
     * §21: a KYC Admin must not automatically gain unrelated financial functions.
     */
    public function test_kyc_admin_cannot_reach_financial_endpoints(): void
    {
        $this->signIn($this->admin(AdminRole::KycAdmin));

        foreach ([
            ['get', '/api/v1/securegate/withdrawals'],
            ['get', '/api/v1/securegate/wallets'],
            ['get', '/api/v1/securegate/accounting/overview'],
            ['post', '/api/v1/securegate/escrow/1/release'],
            ['get', '/api/v1/securegate/tax/summary'],
            ['get', '/api/v1/securegate/fees'],
            ['patch', '/api/v1/securegate/role-applications/1/approve'],
        ] as [$verb, $uri]) {
            $this->json($verb, $uri)->assertForbidden();
        }
    }

    /**
     * The escalation reported in SEC-001: impersonation, KYC approval and
     * Creator/Vendor approval were all reachable by an administrator holding no
     * permissions at all.
     */
    public function test_support_staff_cannot_impersonate_kyc_or_grant_account_upgrades(): void
    {
        $this->signIn($this->admin(AdminRole::SupportStaff));

        $this->postJson('/api/v1/securegate/users/1/impersonate')->assertForbidden();
        $this->postJson('/api/v1/securegate/kyc/1/approve')->assertForbidden();
        $this->patchJson('/api/v1/securegate/role-applications/1/approve')->assertForbidden();
        $this->patchJson('/api/v1/securegate/role-applications/1/reject')->assertForbidden();
        $this->patchJson('/api/v1/securegate/verification-badges/1/status')->assertForbidden();
    }

    public function test_narrow_roles_are_confined_to_their_own_lane(): void
    {
        $this->signIn($this->admin(AdminRole::Moderator));

        $this->getJson('/api/v1/securegate/reports')->assertOk();
        $this->getJson('/api/v1/securegate/users')->assertForbidden();
        $this->getJson('/api/v1/securegate/kyc')->assertForbidden();
        $this->getJson('/api/v1/securegate/settings')->assertForbidden();

        $this->signIn($this->admin(AdminRole::SupportStaff));

        $this->getJson('/api/v1/securegate/settings')->assertForbidden();
        $this->getJson('/api/v1/securegate/admins')->assertForbidden();
        $this->getJson('/api/v1/securegate/analytics/overview')->assertForbidden();
    }

    /**
     * An administrator created without an explicit grant list inherits their
     * role's defaults instead of collapsing to an empty list.
     */
    public function test_new_admin_inherits_role_defaults_when_no_list_is_submitted(): void
    {
        $this->signIn($this->admin(AdminRole::SuperAdmin));

        $response = $this->postJson('/api/v1/securegate/admins', [
            'name' => 'Support Person',
            'email' => 'support.person@murihspace.test',
            'password' => 'correct-horse-battery',
            'admin_role' => AdminRole::SupportStaff->value,
        ]);

        $response->assertCreated();

        $created = User::where('email', 'support.person@murihspace.test')->firstOrFail();

        $this->assertSame(
            AdminPermissionMatrix::defaultNamesFor(AdminRole::SupportStaff),
            AdminPermissionMatrix::effectiveNamesFor($created)
        );
        $this->assertNotContains(
            AdminPermission::Payouts->value,
            AdminPermissionMatrix::effectiveNamesFor($created)
        );
    }

    /**
     * An explicit grant list is honoured verbatim and never widened, so
     * deliberately narrowing an account stays narrowed.
     */
    public function test_explicit_grant_list_is_never_widened(): void
    {
        $admin = $this->admin(AdminRole::FinanceAdmin, [AdminPermission::Tax->value]);

        $this->assertSame([AdminPermission::Tax->value], AdminPermissionMatrix::effectiveNamesFor($admin));
        $this->assertTrue($admin->hasAdminPermission('tax'));
        $this->assertFalse($admin->hasAdminPermission('accounting'));
        $this->assertFalse($admin->hasAdminPermission('wallets'));

        $this->signIn($admin);

        $this->getJson('/api/v1/securegate/tax/summary')->assertOk();
        $this->getJson('/api/v1/securegate/accounting/overview')->assertForbidden();
        $this->getJson('/api/v1/securegate/wallets')->assertForbidden();
    }

    /**
     * SEC-002: any administrator can read their own authority, so a client never
     * needs to guess or hardcode the matrix.
     */
    public function test_any_admin_can_read_their_own_effective_permissions(): void
    {
        $admin = $this->admin(AdminRole::KycAdmin);

        $this->signIn($admin);

        $response = $this->getJson('/api/v1/securegate/me');

        $response->assertOk();

        $data = $response->json('data');

        $this->assertSame(AdminRole::KycAdmin->value, $data['admin_role']);
        $this->assertSame(
            AdminPermissionMatrix::effectiveNamesFor($admin),
            $data['permissions']
        );
        $this->assertArrayHasKey('kyc', $data['sections']);
        $this->assertArrayNotHasKey('finance', $data['sections']);
        $this->assertArrayNotHasKey('settings', $data['sections']);
        $this->assertFalse($data['is_super_admin']);
    }

    public function test_super_admin_resolves_to_every_permission(): void
    {
        $admin = $this->admin(AdminRole::SuperAdmin);

        $this->assertSame(
            AdminPermission::names(),
            AdminPermissionMatrix::effectiveNamesFor($admin)
        );

        foreach (AdminPermission::cases() as $permission) {
            $this->assertTrue($admin->hasAdminPermission($permission->value));
        }
    }

    /**
     * Clients (the admin Flutter app, the web console) build their navigation
     * from the `sections` map, so a permission with no section is invisible —
     * the screen exists on the server but no client can discover it.
     *
     * This failed once already: `approvals` existed as a permission from the
     * moment role upgrades were split out of `users`, but had no section, so
     * the Role Approvals queue was unreachable from any driven client.
     */
    public function test_every_permission_is_reachable_through_at_least_one_section(): void
    {
        $covered = [];

        foreach (AdminPermissionMatrix::sections() as $section) {
            foreach ($section['permissions'] as $permission) {
                $covered[] = $permission->value;
            }
        }

        $unreachable = array_values(array_diff(AdminPermission::names(), $covered));

        $this->assertSame(
            [],
            $unreachable,
            'Permissions with no section are invisible to clients: '.
                ($unreachable ? implode(', ', $unreachable) : 'none')
        );
    }

    public function test_approvals_section_is_advertised_to_a_super_admin(): void
    {
        $this->signIn($this->admin(AdminRole::SuperAdmin));

        $this->getJson('/api/v1/securegate/me')
            ->assertOk()
            ->assertJsonPath('data.sections.approvals', 'Role Approvals');
    }

    public function test_approvals_section_is_withheld_from_a_kyc_admin(): void
    {
        // KYC admin may review identity but must not grant account roles.
        $this->signIn($this->admin(AdminRole::KycAdmin));

        $this->getJson('/api/v1/securegate/me')
            ->assertOk()
            ->assertJsonMissingPath('data.sections.approvals');

        $this->getJson('/api/v1/securegate/role-applications')->assertForbidden();
    }

    public function test_non_admin_is_refused_the_whole_admin_surface(): void
    {
        $this->signIn(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/v1/securegate/me')->assertForbidden();
        $this->getJson('/api/v1/securegate/dashboard')->assertForbidden();
        $this->getJson('/api/v1/securegate/users')->assertForbidden();
    }

    /**
     * The middleware fails closed, so a route wired with the alias but no
     * argument is refused rather than opened.
     */
    public function test_permission_middleware_refuses_when_no_permission_is_declared(): void
    {
        $this->signIn($this->admin(AdminRole::SupportStaff));

        Route::middleware(['auth:sanctum', 'admin', 'admin.permission'])
            ->get('/api/v1/_test-unconfigured-admin-route', fn () => response()->json(['ok' => true]));

        $this->getJson('/api/v1/_test-unconfigured-admin-route')->assertForbidden();
    }
}
