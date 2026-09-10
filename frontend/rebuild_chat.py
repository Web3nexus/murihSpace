import re

with open('src/components/layout/ChatLayout.tsx', 'r') as f:
    content = f.read()

lucide_block = """import {
  MessageSquare, Search, Send, Loader2, Bookmark, Users, ArrowLeft,
  AlertCircle, RotateCcw, BellOff, Archive, MoreVertical,
  Reply, Paperclip, CheckCheck,
} from 'lucide-react';
import { Plus, Video } from 'lucide-react';"""

phosphor_block = """import {
  ChatTeardropText as MessageSquare,
  MagnifyingGlass as Search,
  PaperPlaneRight as Send,
  Spinner as Loader2,
  BookmarkSimple as Bookmark,
  Users,
  ArrowLeft,
  WarningCircle as AlertCircle,
  ArrowCounterClockwise as RotateCcw,
  BellSlash as BellOff,
  Archive,
  DotsThreeVertical as MoreVertical,
  ArrowUUpLeft as Reply,
  Paperclip,
  Checks as CheckCheck,
  Plus,
  VideoCamera as Video
} from '@phosphor-icons/react';"""

if lucide_block in content:
    content = content.replace(lucide_block, phosphor_block)
else:
    # try regex
    content = re.sub(r"import \{[\s\S]*?\} from 'lucide-react';", phosphor_block, content)

for icon in ["MessageSquare", "Search", "Send", "Loader2", "Bookmark", "Users", "ArrowLeft", "AlertCircle", "RotateCcw", "BellOff", "Archive", "MoreVertical", "Reply", "Paperclip", "CheckCheck", "Plus", "Video"]:
    content = re.sub(rf'<{icon}\b(?!.*weight="fill")', rf'<{icon} weight="fill"', content)

with open('src/components/layout/ChatLayout.tsx', 'w') as f:
    f.write(content)
