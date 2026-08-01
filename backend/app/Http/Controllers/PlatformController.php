<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use Illuminate\Http\JsonResponse;

class PlatformController extends Controller
{
    /**
     * Public platform config used by the web login/registration and the
     * "locked to app" screens (no authentication required).
     */
    public function config(): JsonResponse
    {
        $disabledRoles = json_decode((string) AdminSetting::get('web_disabled_roles', '[]'), true);
        $downloadUrl = (string) config('app.app_download_url');

        return response()->json([
            'data' => [
                'platform_name' => config('app.name'),
                'web_disabled_roles' => array_values(array_unique(is_array($disabledRoles) ? $disabledRoles : [])),
                'app_download_url' => $downloadUrl,
                'app_qr_content' => $downloadUrl,
            ],
        ]);
    }
}
