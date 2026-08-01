<?php

use App\Providers\AppServiceProvider;
use App\Providers\HorizonServiceProvider;
use App\Providers\ObjectStorageServiceProvider;

return [
    AppServiceProvider::class,
    HorizonServiceProvider::class,
    ObjectStorageServiceProvider::class,
];
