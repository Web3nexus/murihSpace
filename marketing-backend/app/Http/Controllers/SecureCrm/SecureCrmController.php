<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;

class SecureCrmController extends Controller
{
    public function index()
    {
        return redirect()->route('securecrm.overview');
    }
}
