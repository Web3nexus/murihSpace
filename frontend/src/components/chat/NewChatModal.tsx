import React from 'react';
import { MessageSquare, UserPlus, Users, X } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: 'chat' | 'contact' | 'community') => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop click handler */}
      <div className="fixed inset-0" onClick={onClose} role="button" tabIndex={-1} aria-label="Close modal" />

      {/* Modal Sheet */}
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-card border border-border/80 shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h3 className="text-base font-extrabold text-foreground">Create New</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          {/* Option 1: New Chat */}
          <button
            type="button"
            onClick={() => {
              onSelectAction('chat');
              onClose();
            }}
            className="w-full flex items-start gap-3.5 p-3.5 rounded-2xl hover:bg-muted/70 transition-all text-left group"
          >
            <div className="p-2.5 rounded-xl bg-secondary/15 text-secondary group-hover:bg-secondary group-hover:text-white transition-colors shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground group-hover:text-secondary transition-colors">
                New Chat
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Send a message to your contact
              </p>
            </div>
          </button>

          {/* Option 2: New Contact */}
          <button
            type="button"
            onClick={() => {
              onSelectAction('contact');
              onClose();
            }}
            className="w-full flex items-start gap-3.5 p-3.5 rounded-2xl hover:bg-muted/70 transition-all text-left group border-t border-border/30"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground group-hover:text-amber-500 transition-colors">
                New Contact
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add a contact to be able to send message
              </p>
            </div>
          </button>

          {/* Option 3: New Community */}
          <button
            type="button"
            onClick={() => {
              onSelectAction('community');
              onClose();
            }}
            className="w-full flex items-start gap-3.5 p-3.5 rounded-2xl hover:bg-muted/70 transition-all text-left group border-t border-border/30"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground group-hover:text-emerald-500 transition-colors">
                New Community
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Join the community around you
              </p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-muted text-muted-foreground hover:text-foreground font-bold text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
