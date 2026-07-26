<?php

namespace App\Jobs;

use App\Mail\BroadcastMail;
use App\Models\EmailBroadcast;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendBroadcastEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public EmailBroadcast $broadcast,
        public User $subscriber,
    ) {}

    public function handle(): void
    {
        Mail::to($this->subscriber->email)
            ->send(new BroadcastMail($this->broadcast, $this->subscriber));

        Log::info('Broadcast email dispatched', [
            'broadcast_id' => $this->broadcast->id,
            'subscriber_id' => $this->subscriber->id,
            'email' => $this->subscriber->email,
            'subject' => $this->broadcast->subject,
        ]);
    }
}
