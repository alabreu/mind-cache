import type { pt } from './pt'

/** English messages — o tipo força paridade de chaves com o pt. */
export const en: Record<keyof typeof pt, string> = {
  // Common
  'common.back': 'Back',

  // Home
  'home.menuButton': 'Menu',
  'home.menuButtonUnread': 'Menu — unread news available',

  // Capture
  'capture.label': 'Capture',
  'capture.placeholder': 'Paste a link, jot an idea…',
  'capture.hint': 'Enter sends · Shift+Enter adds a line',
  'capture.signedOutTitle': 'Sign in to start',
  'capture.signedOutBody':
    'The cache lives in your account, so capturing needs a sign-in.',
  'capture.signIn': 'Sign in',
  'capture.noBackendTitle': 'Backend not configured',
  'capture.noBackendBody':
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and run the migrations for the cache to work.',

  // Settings
  'settings.title': 'Settings',
  'settings.bookmarkletTitle': 'Capture from the browser',
  'settings.bookmarkletBody':
    'Drag the button below to your bookmarks bar. On any page, clicking it captures the link, the title and any selected text.',
  'settings.bookmarkletLabel': '+ Mind Cache',
  'settings.bookmarkletHint':
    'If the bookmarks bar is hidden, show it before dragging.',
  'settings.installTitle': 'Install on your phone',
  'settings.installBody':
    'Install the app from your browser menu. After that, Mind Cache shows up as a share target from any other app.',

  // Search
  'search.label': 'Search the cache',
  'search.placeholder': 'Search…',
  'search.clear': 'Clear search',
  'search.noResults': 'Nothing found.',
  'search.noResultsHint': 'Try other words or drop the filters.',
  'search.allTags': 'All',

  // List
  'items.empty': 'Nothing cached yet.',
  'items.emptyHint': 'Whatever you capture shows up here.',
  'items.loadError': "Couldn't load the cache.",
  'items.retryLoad': 'Try again',
  'items.loadMore': 'Load more',
  'items.loading': 'Loading…',
  'items.pending': 'Saving…',
  'items.failed': "Didn't save",
  'items.retrySave': 'Try again',
  'items.showArchived': 'Include archived',
  'items.expand': 'Open item',
  'items.collapse': 'Close item',
  'items.copy': 'Copy',
  'items.copied': 'Copied',
  'items.open': 'Open link',
  'items.pin': 'Pin',
  'items.unpin': 'Unpin',
  'items.archive': 'Archive',
  'items.unarchive': 'Unarchive',
  'items.delete': 'Delete',
  'items.archivedBadge': 'archived',
  'items.fromWhatsapp': 'from WhatsApp',
  'items.titleLabel': 'Title',
  'items.titlePlaceholder': 'no title',
  'items.noteLabel': 'Note',
  'items.notePlaceholder': 'why does this matter?',
  'items.tagsLabel': 'Tags',
  'items.tagsPlaceholder': 'comma separated',

  // Menu
  'menu.settings': 'Settings',
  'menu.feedback': 'Send feedback',
  'menu.language': 'Language',
  'menu.news': "What's new",
  'menu.donate': 'Support the app',
  'menu.login': 'Sign in',

  // Auth
  'auth.title': 'Sign in',
  'auth.subtitle': 'Sign in to sync your data on any device.',
  'auth.google': 'Continue with Google',
  'auth.or': 'or',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.toSignUp': "No account? Create one",
  'auth.toSignIn': 'Already have an account? Sign in',
  'auth.guestNote': 'You can keep using the app without an account.',
  'auth.soon': 'Sign-in will be available soon.',
  'auth.error': "Couldn't sign in. Check your details and try again.",
  'auth.signedInAs': 'Signed in as',
  'auth.signOut': 'Sign out',

  // Feedback
  'feedback.title': 'Send feedback',
  'feedback.intro': 'Your feedback helps improve the app. Tell us what you think.',
  'feedback.typeLabel': 'Type',
  'feedback.type.bug': 'Bug',
  'feedback.type.idea': 'Idea',
  'feedback.type.other': 'Other',
  'feedback.messageLabel': 'Message',
  'feedback.messagePlaceholder': 'What happened? What could be better?',
  'feedback.emailLabel': 'Your email (optional)',
  'feedback.emailPlaceholder': 'so we can get back to you',
  'feedback.send': 'Send',
  'feedback.sentTitle': 'Thank you!',
  'feedback.sentBody': 'We received your feedback. 🙌',
  'feedback.sentMailBody': 'We opened your email with the feedback — just hit send. 🙌',
  'feedback.error': "Couldn't send right now. Try again in a moment.",
  'feedback.another': 'Send another',

  // Donations
  'donate.title': 'Support the app',
  'donate.body':
    'This app is free. If it helps you, a donation of any amount helps keep the servers and development going.',
  'donate.button': 'Make a donation',
  'donate.thanks': 'Every amount makes a difference. Thank you! 💜',
  'donate.soon': 'Donations will be available soon.',

  // Language
  'language.title': 'Language',
  'language.subtitle': 'Choose the app language.',

  // News (changelog)
  'news.title': "What's new",
  'news.subtitle': "What's new in the app.",
  'news.badgeNew': 'new',

  // Admin (operator panel — /admin)
  'admin.title': 'Admin',
  'admin.restricted': 'Restricted area.',
  'admin.users': 'Users',
  'admin.dau': 'DAU',
  'admin.wau': 'WAU',
  'admin.mau': 'MAU',
  'admin.feedback': 'Feedback',
  'admin.sessionsByDay': 'Sessions per day (30d)',
  'admin.noData': 'No data yet.',
  'admin.feedbackInbox': 'Feedback inbox',
  'admin.feedbackEmpty': 'No feedback yet.',

  // Update toast
  'update.available': 'New version available',
  'update.action': 'Update',
  'update.updating': 'Updating…',
  'update.dismiss': 'Dismiss',
}
