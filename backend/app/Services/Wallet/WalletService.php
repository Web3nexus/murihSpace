<?php

namespace App\Services\Wallet;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Collection;

class WalletService
{
    /**
     * Ensure all required wallets exist for a user based on their role.
     * - 'member' / normal user -> System Wallet
     * - 'creator'              -> System Wallet + Creator Wallet
     * - 'vendor'               -> System Wallet + Business Wallet
     * - 'admin'                -> System Wallet
     */
    public function provisionForUser(User $user, string $currency = 'NGN'): Collection
    {
        $types = ['system'];

        if ($user->role === 'creator' || $user->isCreatorOrAdmin()) {
            $types[] = 'creator';
        }

        if ($user->role === 'vendor' || $user->role === 'creator') {
            $types[] = 'business';
        }

        $wallets = collect();

        foreach ($types as $type) {
            $wallets->push($this->getOrCreateWallet($user, $type, $currency));
        }

        return $wallets;
    }

    /**
     * Get or create a specific wallet type for a user.
     */
    public function getOrCreateWallet(User $user, string $walletType = 'system', string $currency = 'NGN'): Wallet
    {
        return Wallet::firstOrCreate(
            ['user_id' => $user->id, 'wallet_type' => $walletType],
            [
                'currency'         => $currency,
                'available'        => 0,
                'pending'          => 0,
                'reserved'         => 0,
                'escrow'           => 0,
                'withdrawable'     => 0,
                'non_withdrawable' => 0,
                'disputed'         => 0,
                'status'           => 'active',
            ]
        );
    }

    /**
     * Get all wallets for a user.
     */
    public function getUserWallets(User $user): Collection
    {
        // Auto-provision if missing
        $this->provisionForUser($user);

        return Wallet::where('user_id', $user->id)->get();
    }
}
