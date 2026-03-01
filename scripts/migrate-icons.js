const fs = require('fs');
const path = require('path');

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

// LoadingSpinner component
const loadingSpinnerComponent = `
// LoadingSpinner component for Loader2 replacement
const LoadingSpinner = ({ size = 16 }) => (
  <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
);
`;

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File not found: ' + filePath);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Check if file has lucide-react import
  if (!content.includes('lucide-react')) {
    console.log('No lucide-react import in: ' + filePath);
    return;
  }

  // Extract lucide-react imports
  const lucideImportRegex = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["'];?/;
  const match = content.match(lucideImportRegex);

  if (!match) {
    console.log('Could not parse lucide import in: ' + filePath);
    return;
  }

  const importedIcons = match[1].split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  console.log('Processing ' + filePath + ': ' + importedIcons.join(', '));

  // Check for Loader2 and LucideIcon
  const hasLoader2 = importedIcons.includes('Loader2');
  const hasLucideIcon = importedIcons.includes('LucideIcon');

  // Map icons
  const iconlyIcons = [];
  const unmappedIcons = [];

  for (const icon of importedIcons) {
    if (icon === 'Loader2') continue;
    if (icon === 'LucideIcon') continue;

    if (iconMappings[icon]) {
      if (!iconlyIcons.includes(iconMappings[icon])) {
        iconlyIcons.push(iconMappings[icon]);
      }
    } else {
      unmappedIcons.push(icon);
    }
  }

  if (unmappedIcons.length > 0) {
    console.log('  Unmapped icons: ' + unmappedIcons.join(', '));
  }

  // Generate new import
  let newImport = '';
  if (iconlyIcons.length > 0) {
    newImport = 'import { ' + iconlyIcons.join(', ') + ' } from "react-iconly";';
  }

  // Add LoadingSpinner if needed
  if (hasLoader2) {
    newImport += loadingSpinnerComponent;
  }

  // Replace import
  content = content.replace(lucideImportRegex, newImport);

  // Write back
  fs.writeFileSync(filePath, content);
  console.log('  Updated: ' + filePath);
}

// Process all files
for (const file of files) {
  processFile(file);
}

console.log('Migration complete!');
