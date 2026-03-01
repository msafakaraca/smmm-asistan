const fs = require('fs');

// Icon mappings from lucide-react to react-iconly
const iconMappings = {
  'Plus': 'Plus',
  'Clock': 'TimeCircle',
  'Calendar': 'Calendar',
  'User': 'User',
  'Users': 'People',
  'Building2': 'Work',
  'Mail': 'Send',
  'Send': 'Send',
  'Folder': 'Folder',
  'FolderOpen': 'Folder',
  'Lock': 'Lock',
  'Unlock': 'Unlock',
  'Settings': 'Setting',
  'Cog': 'Setting',
  'MessageSquare': 'Chat',
  'Chat': 'Chat',
  'MessageCircle': 'Message',
  'Home': 'Home',
  'LayoutDashboard': 'Category',
  'ClipboardCheck': 'TickSquare',
  'StickyNote': 'Document',
  'FileText': 'Document',
  'Pencil': 'Edit',
  'Edit': 'Edit',
  'Trash': 'Delete',
  'Trash2': 'Delete',
  'MoreVertical': 'MoreSquare',
  'MoreHorizontal': 'MoreSquare',
  'MapPin': 'Location',
  'Location': 'Location',
  'Bell': 'Notification',
  'Notification': 'Notification',
  'Download': 'Download',
  'Upload': 'Upload',
  'Filter': 'Filter',
  'Star': 'Star',
  'Heart': 'Heart',
  'Info': 'InfoCircle',
  'AlertCircle': 'Danger',
  'AlertTriangle': 'Danger',
  'CheckCircle': 'TickSquare',
  'CheckCircle2': 'TickSquare',
  'XCircle': 'CloseSquare',
  'ArrowLeft': 'ArrowLeft',
  'ArrowRight': 'ArrowRight',
  'ArrowUp': 'ArrowUp',
  'ArrowDown': 'ArrowDown',
  'ChevronLeft': 'ChevronLeft',
  'ChevronRight': 'ChevronRight',
  'ChevronUp': 'ChevronUp',
  'ChevronDown': 'ChevronDown',
  'RefreshCw': 'Swap',
  'Repeat': 'Swap',
  'Eye': 'Show',
  'EyeOff': 'Hide',
  'Phone': 'Call',
  'Image': 'Image',
  'Play': 'Play',
  'Copy': 'Paper',
  'ExternalLink': 'Send',
  'LogOut': 'Logout',
  'LogIn': 'Login',
  'X': 'CloseSquare',
  'Search': 'Search',
  'Check': 'TickSquare',
};

// Files to process
const files = [
  'src/components/reminders/reminder-card.tsx',
  'src/components/reminders/note-card.tsx',
  'src/components/reminders/phone-input-multi.tsx',
  'src/components/reminders/date-time-picker.tsx',
  'src/components/reminders/empty-state.tsx',
  'src/components/reminders/horizontal-date-time-picker.tsx',
  'src/components/reminders/reminders-panel.tsx',
  'src/components/reminders/notes-panel.tsx',
  'src/components/reminders/reminders-tab.tsx',
  'src/components/reminders/notes-tab.tsx',
  'src/components/reminders/calendar-date-picker.tsx',
  'src/components/reminders/reminders-page.tsx',
];

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File not found: ' + filePath);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace JSX patterns for each icon
  for (const [lucide, iconly] of Object.entries(iconMappings)) {
    // Pattern 1: <Icon className="h-X w-X" />
    const pattern1 = new RegExp('<' + lucide + '\\s+className="([^"]*)"\\s*\\/>', 'g');
    content = content.replace(pattern1, function(match, classes) {
      changed = true;
      // Extract size from h-X pattern
      const sizeMatch = classes.match(/h-(\\d+)/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) * 4 : 16;
      return '<' + iconly + ' set="curved" primaryColor="currentColor" size={' + size + '} />';
    });

    // Pattern 2: <Icon className={cn(...)} /> - complex, just replace icon name
    const pattern2 = new RegExp('<' + lucide + '(\\s+)', 'g');
    if (content.includes('<' + lucide)) {
      content = content.replace(pattern2, '<' + iconly + '$1');
      changed = true;
    }
  }

  // Replace Loader2 with LoadingSpinner
  content = content.replace(/<Loader2\s+className="([^"]*)"\s*\/>/g, function(match, classes) {
    changed = true;
    const sizeMatch = classes.match(/h-(\\d+)/);
    const size = sizeMatch ? parseInt(sizeMatch[1]) * 4 : 16;
    return '<LoadingSpinner size={' + size + '} />';
  });

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Updated JSX in: ' + filePath);
  } else {
    console.log('No JSX changes needed in: ' + filePath);
  }
}

// Process all files
for (const file of files) {
  processFile(file);
}

console.log('JSX migration complete!');
