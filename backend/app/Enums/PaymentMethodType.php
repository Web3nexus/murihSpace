<?php

namespace App\Enums;

enum PaymentMethodType: string
{
    case Card = 'card';
    case BankTransfer = 'bank_transfer';
    case MobileMoney = 'mobile_money';
    case Wallet = 'wallet';
    case ApplePay = 'apple_pay';
    case GooglePay = 'google_pay';
}
