<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{ $subject ?? config('app.name') }}</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        body { margin: 0; padding: 0; width: 100% !important; word-break: break-word; }
        table { border-collapse: collapse !important; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
        .mso-line-height-rule { mso-line-height-rule: exactly; }
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
        .btn {
            display: inline-block; padding: 12px 28px; border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px; font-weight: 700; color: #ffffff !important;
            background-color: #38A8D8; text-decoration: none !important;
        }
        .btn:hover { background-color: #2e94c0; }
        @media screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .px { padding-left: 20px !important; padding-right: 20px !important; }
            .stack { display: block !important; width: 100% !important; }
        }
    </style>
</head>
<body style="margin:0; padding:0; background-color:#F0F2F5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0F2F5;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <!--[if (gte mso 9)|(IE)]><table width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
                <table role="presentation" class="container" width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; margin:0 auto;">
                    <!-- Header / Logo -->
                    <tr>
                        <td align="center" style="padding:0 0 24px 0;">
                            <a href="{{ config('app.frontend_url') }}" style="text-decoration:none;">
                                <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:24px; font-weight:800; color:#102840; letter-spacing:-0.5px;">
                                    Murih<span style="color:#38A8D8;">Space</span>
                                </span>
                            </a>
                        </td>
                    </tr>

                    <!-- Card -->
                    <tr>
                        <td style="background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 4px 20px rgba(16,40,64,0.08);">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <!-- Accent bar -->
                                <tr>
                                    <td style="height:6px; background:linear-gradient(90deg, #38A8D8 0%, #102840 100%);" height="6"></td>
                                </tr>
                                <tr>
                                    <td class="px" style="padding:32px 36px 8px 36px;">
                                        <h1 style="margin:0 0 8px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:22px; font-weight:800; color:#102840; letter-spacing:-0.3px;">
                                            {{ $title }}
                                        </h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="px" style="padding:0 36px 24px 36px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:14px; line-height:1.6; color:#4B5563;">
                                                    <p style="margin:0 0 12px 0;">Hi {{ $name }},</p>
                                                    {!! $body !!}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                @if(!empty($actionLabel) && !empty($actionUrl))
                                <tr>
                                    <td class="px" align="center" style="padding:0 36px 28px 36px;">
                                        <a href="{{ $actionUrl }}" class="btn">{{ $actionLabel }}</a>
                                    </td>
                                </tr>
                                @endif

                                @if(!empty($footnote))
                                <tr>
                                    <td class="px" style="padding:0 36px 24px 36px;">
                                        <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; line-height:1.5; color:#9CA3AF;">
                                            {{ $footnote }}
                                        </p>
                                    </td>
                                </tr>
                                @endif
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding:24px 16px 8px 16px;">
                            <p style="margin:0 0 4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:#9CA3AF;">
                                &copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.
                            </p>
                            <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:#B0B7C0;">
                                You received this email because of activity on your {{ config('app.name') }} account.
                            </p>
                        </td>
                    </tr>
                </table>
                <!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
