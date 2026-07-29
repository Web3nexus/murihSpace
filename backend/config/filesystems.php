<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Active Upload Disk
    |--------------------------------------------------------------------------
    |
    | The disk used for user file uploads. Set via UPLOAD_DISK env var.
    | Options: local_uploads, s3, wasabi, bunny
    |
    */

    'upload_disk' => env('UPLOAD_DISK', 'local_uploads'),

    /*
    |--------------------------------------------------------------------------
    | Uploads Folder
    |--------------------------------------------------------------------------
    |
    | The folder/prefix within the upload disk where files are stored.
    |
    */

    'upload_folder' => env('UPLOAD_FOLDER', 'uploads'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

        /*
        |--------------------------------------------------------------------------
        | Upload Disks
        |--------------------------------------------------------------------------
        |
        | Storage backends for user-uploaded files. The active disk is selected
        | via the UPLOAD_DISK env var (default: local_uploads).
        |
        | Supported providers:
        |   local_uploads - Local VPS storage (public/ subfolder)
        |   s3            - Amazon S3 or S3-compatible (Wasabi, DigitalOcean Spaces, etc.)
        |   wasabi        - Wasabi hot storage (S3-compatible)
        |   bunny         - Bunny.net CDN storage
        |
        */

        'local_uploads' => [
            'driver' => 'local',
            'root' => storage_path('app/public/uploads'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage/uploads',
            'visibility' => 'public',
            'throw' => false,
        ],

        'wasabi' => [
            'driver' => 's3',
            'key' => env('WASABI_ACCESS_KEY_ID'),
            'secret' => env('WASABI_SECRET_ACCESS_KEY'),
            'region' => env('WASABI_REGION', 'us-east-1'),
            'bucket' => env('WASABI_BUCKET'),
            'endpoint' => env('WASABI_ENDPOINT', 'https://s3.wasabisys.com'),
            'url' => env('WASABI_URL'),
            'use_path_style_endpoint' => false,
            'throw' => false,
            'report' => false,
        ],

        'bunny' => [
            'driver' => 's3',
            'key' => env('BUNNY_STORAGE_ZONE'),
            'secret' => env('BUNNY_STORAGE_PASSWORD'),
            'region' => env('BUNNY_REGION', 'de'),
            'bucket' => env('BUNNY_STORAGE_ZONE'),
            'endpoint' => env('BUNNY_ENDPOINT', 'https://de-s3.storage.bunnycdn.com'),
            'url' => env('BUNNY_CDN_URL'),
            'use_path_style_endpoint' => true,
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
