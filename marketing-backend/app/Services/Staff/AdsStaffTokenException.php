<?php

namespace App\Services\Staff;

use RuntimeException;

/**
 * Carries a machine-readable reason: ads_token_unavailable, staff_not_active
 * or no_matching_role.
 */
class AdsStaffTokenException extends RuntimeException {}
