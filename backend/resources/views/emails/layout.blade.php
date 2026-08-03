<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{ $subject ?? $title ?? config('app.name') }}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        /* General Resets */
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            width: 100% !important;
            background-color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        * {
            -ms-text-size-adjust: 100%;
            -webkit-text-size-adjust: 100%;
        }
        div[style*="margin: 16px 0"] {
            margin: 0 !important;
        }
        table, td {
            mso-table-lspace: 0pt !important;
            mso-table-rspace: 0pt !important;
            border-collapse: collapse !important;
        }
        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }
        a {
            text-decoration: none;
            color: #2563eb;
        }
        a[x-apple-data-detectors] {
            color: inherit !important;
            text-decoration: none !important;
            font-size: inherit !important;
            font-family: inherit !important;
            font-weight: inherit !important;
            line-height: inherit !important;
        }
        
        /* Interactive Button Styles */
        .cta-button {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 15px;
            font-weight: 600;
            line-height: 1;
            text-align: center;
            text-decoration: none !important;
            padding: 14px 40px;
            border-radius: 9999px;
            -webkit-border-radius: 9999px;
            -moz-border-radius: 9999px;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
            transition: background-color 0.2s ease;
        }
        .cta-button:hover {
            background-color: #1d4ed8 !important;
        }

        /* Utility Styles */
        .text-primary { color: #2563eb !important; }
        .text-dark { color: #111827 !important; }
        .text-muted { color: #6b7280 !important; }
        .text-light { color: #9ca3af !important; }

        @media screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                padding-left: 20px !important;
                padding-right: 20px !important;
            }
            .cta-button {
                width: 100% !important;
                box-sizing: border-box !important;
                padding-left: 16px !important;
                padding-right: 16px !important;
            }
            .content-padding {
                padding-top: 30px !important;
                padding-bottom: 30px !important;
            }
        }
    </style>
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
    <!-- Outer Wrapper -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; margin:0; padding:0; width:100%;">
        <tr>
            <td align="center" style="padding: 40px 16px 60px 16px;">
                <!--[if (gte mso 9)|(IE)]>
                <table align="center" border="0" cellspacing="0" cellpadding="0" width="560">
                <tr>
                <td align="center" valign="top" width="560">
                <![endif]-->
                
                <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; margin: 0 auto; text-align: center;">
                    
                    <!-- Header Logo -->
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <a href="{{ config('app.frontend_url', 'https://murihspace.com') }}" target="_blank" style="text-decoration: none;">
                                @if(!empty($logoUrl))
                                    <img src="{{ $logoUrl }}" alt="{{ config('app.name', 'MurihSpace') }}" width="140" style="display: block; max-width: 160px; height: auto;">
                                @else
                                    {{-- Text-only logo: inline SVG is stripped by Gmail, Outlook and Yahoo --}}
                                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 700; color: #111827; letter-spacing: -0.5px; text-decoration: none;">
                                        {{ config('app.name', 'MurihSpace') }}
                                    </span>
                                @endif
                            </a>
                        </td>
                    </tr>

                    <!-- Main Headline -->
                    @if(!empty($title))
                    <tr>
                        <td align="center" style="padding-bottom: 16px;">
                            <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; line-height: 1.3; color: #111827; letter-spacing: -0.4px;">
                                {!! $title !!}
                            </h1>
                        </td>
                    </tr>
                    @endif

                    <!-- Body Content -->
                    <tr>
                        <td align="center" style="padding-bottom: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #4b5563;">
                            @if(!empty($name))
                                <p style="margin: 0 0 12px 0; font-weight: 500; color: #374151;">Hi {{ $name }},</p>
                            @endif
                            
                            <div style="margin: 0; color: #4b5563;">
                                {!! $body ?? $bodyHtml ?? '' !!}
                            </div>
                        </td>
                    </tr>

                    <!-- Details / Key-Value Pairs (Optional) -->
                    @if(!empty($details) && is_array($details))
                    <tr>
                        <td align="center" style="padding-bottom: 28px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; background-color: #f8fafc; border-radius: 12px; padding: 12px 20px;">
                                @foreach($details as $label => $value)
                                @continue(is_array($value) || is_object($value))
                                <tr>
                                    <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #374151; padding: 4px 0;">
                                        @if(! is_int($label))
                                            <strong style="color: #111827; font-weight: 600;">{{ $label }}:</strong>
                                        @endif
                                        <span style="color: #2563eb; font-weight: 500;">{{ $value }}</span>
                                    </td>
                                </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    @elseif(!empty($metaText))
                    <tr>
                        <td align="center" style="padding-bottom: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #111827;">
                            {!! $metaText !!}
                        </td>
                    </tr>
                    @endif

                    <!-- CTA Primary Action Button -->
                    @if(!empty($actionUrl) && !empty($actionLabel))
                    <tr>
                        <td align="center" style="padding-top: 8px; padding-bottom: 32px;">
                            <!--[if mso]>
                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ $actionUrl }}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="100%" stroke="f" fillcolor="#2563eb">
                                <w:anchorlock/>
                                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">{{ $actionLabel }}</center>
                            </v:roundrect>
                            <![endif]-->
                            <!--[if !mso]><!-->
                            <a href="{{ $actionUrl }}" target="_blank" class="cta-button">
                                {{ $actionLabel }}
                            </a>
                            <!--<![endif]-->
                        </td>
                    </tr>

                    <!-- Fallback Link Instruction -->
                    <tr>
                        <td align="center" style="padding-bottom: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: #6b7280;">
                            <p style="margin: 0 0 6px 0;">If the button does not work, copy and paste this link into your browser:</p>
                            <a href="{{ $actionUrl }}" target="_blank" style="color: #2563eb; word-break: break-all; text-decoration: underline;">
                                {{ $actionUrl }}
                            </a>
                        </td>
                    </tr>
                    @endif

                    <!-- Footnote / Secondary Notice -->
                    <tr>
                        <td align="center" style="padding-bottom: 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: #6b7280;">
                            <p style="margin: 0;">
                                {{ $footnote ?? $disclaimer ?? "If you weren't expecting this email, you can safely ignore it." }}
                            </p>
                        </td>
                    </tr>

                    <!-- Footer Section -->
                    <tr>
                        <td align="center" style="border-top: 1px solid #f3f4f6; padding-top: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6; color: #9ca3af;">
                            <p style="margin: 0 0 8px 0;">
                                Need help? Email <a href="mailto:{{ $supportEmail ?? config('mail.support_address', 'hello@murihspace.com') }}" style="color: #6b7280; text-decoration: underline;">{{ $supportEmail ?? config('mail.support_address', 'hello@murihspace.com') }}</a>
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                &copy; {{ date('Y') }} {{ config('app.name', 'MurihSpace') }} &bull; San Francisco, USA
                            </p>
                        </td>
                    </tr>

                </table>

                <!--[if (gte mso 9)|(IE)]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
