import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Users,
  Briefcase,
  GraduationCap,
  BookOpen,
  Layers,
  ClipboardCheck,
  CalendarCheck,
  IndianRupee,
  CalendarDays,
  Trophy,
  FolderKanban,
  CheckSquare,
  Award,
  BarChart3,
  FileText,
  Settings,
  Upload,
  Bell,
  Lightbulb,
  GitBranch,
  HelpCircle,
  UserCircle,
  Wallet,
} from 'lucide-react';

export const SUPER_ADMIN_PILLARS = [
  {
    group: 'Overview',
    icon: LayoutDashboard,
    subtitle: 'Dashboard • Alerts • Reports',
    description: 'Organization overview, categorized alerts, and audit analytics',
    items: [
      { to: '/dashboard', label: 'Dashboard', desc: 'KPIs, revenue & live activity feed', icon: LayoutDashboard },
      { to: '/notifications', label: 'Notifications', desc: 'Categorized alerts & pitch reviews', icon: Bell, badgeKey: 'unreadNotifications' },
      { to: '/reports', label: 'Reports & Audit', desc: 'Finance, course & audit analytics', icon: BarChart3 },
    ],
  },
  {
    group: 'Leave & Fee Due',
    icon: Wallet,
    subtitle: 'Dues • Leave Management',
    description: 'Approve due requests and 3+ day student leave requests',
    items: [
      { to: '/finance', label: 'Finance & Dues', desc: 'Approve due requests & inspect ledgers', icon: IndianRupee },
      { to: '/leaves', label: 'Leave Management', desc: 'Approve or reject 3+ day student leaves', icon: GitBranch },
    ],
  },
  {
    group: 'Organization & People',
    icon: Users,
    subtitle: 'Org • Users • Staff • Students',
    description: 'Company setup, role permissions, staff, and student directories',
    items: [
      { to: '/organization', label: 'Organization', desc: 'Company profile, departments & notices', icon: Building2 },
      { to: '/users', label: 'Users & Roles', desc: 'Accounts, access roles & permissions', icon: ShieldCheck },
      { to: '/employees', label: 'Employees', desc: 'Staff directory & designations', icon: Users },
      { to: '/students', label: 'Students', desc: 'Student profiles & academic status', icon: GraduationCap },
    ],
  },
  {
    group: 'Programs & System',
    icon: Layers,
    subtitle: 'Courses • Events • Settings',
    description: 'Academic catalog, events management, and system configuration',
    items: [
      { to: '/courses', label: 'Courses', desc: 'Catalog, syllabus & fee controls', icon: BookOpen },
      { to: '/events', label: 'Events', desc: 'Hackathons, workshops & schedules', icon: CalendarDays },
      { to: '/settings', label: 'Settings', desc: 'Platform configuration & preferences', icon: Settings },
    ],
  },
];

export const SUPER_ADMIN_SUPPORT_GROUP = {
  group: 'Support & Compliance',
  icon: HelpCircle,
  subtitle: 'Help • Privacy Policy',
  description: 'Platform guidance, role policies, and data privacy standards',
  items: [
    { to: '/help', label: 'Help & Support', desc: 'Documentation & support guides', icon: HelpCircle },
    { to: '/privacy-policy', label: 'Privacy Policy', desc: 'Data governance & privacy policy', icon: ShieldCheck },
  ],
};

export const SUPER_ADMIN_SETTINGS_GROUP = {
  group: 'Settings',
  icon: Settings,
  subtitle: 'Profile • Theme • System',
  description: 'Personal profile, appearance theme, and platform configuration',
  items: [
    { to: '/profile', label: 'My Profile', desc: 'Personal details, avatar & password', icon: UserCircle },
    { to: '/settings', label: 'System Settings', desc: 'Organization, branding & thresholds', icon: Settings },
  ],
};

export const NAV_BY_ROLE = {
  SUPER_ADMIN: SUPER_ADMIN_PILLARS,
  ADMIN: [
    {
      group: 'Overview',
      icon: LayoutDashboard,
      subtitle: 'Dashboard • Alerts • Reports',
      description: 'Daily operations, notifications, and reports',
      items: [
        { to: '/dashboard', label: 'Dashboard', desc: 'Daily operations & pending counts', icon: LayoutDashboard },
        { to: '/notifications', label: 'Notifications', desc: 'Alerts & action items', icon: Bell, badgeKey: 'unreadNotifications' },
        { to: '/reports', label: 'Reports', desc: 'Finance, course & event reports', icon: BarChart3 },
      ],
    },
    {
      group: 'Leave & Fee Due',
      icon: Wallet,
      subtitle: 'Leaves • Finance',
      description: 'Review staff & student leaves, dues, and payments',
      items: [
        { to: '/leaves', label: 'Leave Management', desc: 'Staff leaves & 3+ day student leaves', icon: GitBranch },
        { to: '/finance', label: 'Finance & Dues', desc: 'Invoices, due requests & expenses', icon: IndianRupee },
      ],
    },
    {
      group: 'People & HR',
      icon: Users,
      subtitle: 'Users • Staff • HRMS • Students',
      description: 'Manage accounts, employees, HRMS, and student records',
      items: [
        { to: '/users', label: 'Users & Roles', desc: 'Manage user accounts & roles', icon: ShieldCheck },
        { to: '/employees', label: 'Employees', desc: 'Employee directory & onboarding', icon: Users },
        { to: '/hrms', label: 'HRMS & Attendance', desc: 'Staff attendance & leave log', icon: Briefcase },
        { to: '/students', label: 'Students', desc: 'Student profiles & status', icon: GraduationCap },
      ],
    },
    {
      group: 'Academy',
      icon: BookOpen,
      subtitle: 'Courses • Batches • Enrolments',
      description: 'Manage academic catalog, batches, enrolments, and attendance',
      items: [
        { to: '/courses', label: 'Courses', desc: 'Course catalog & pricing', icon: BookOpen },
        { to: '/batches', label: 'Batches', desc: 'Batch schedules & capacity', icon: Layers },
        { to: '/enrollments', label: 'Enrolments', desc: 'Approve student enrolments', icon: ClipboardCheck },
        { to: '/attendance', label: 'Attendance', desc: 'Student session attendance', icon: CalendarCheck },
      ],
    },
    {
      group: 'Events & Delivery',
      icon: Trophy,
      subtitle: 'Events • Projects • Certs',
      description: 'Competitions, project tracking, tasks, and certificates',
      items: [
        { to: '/events', label: 'Events', desc: 'Create & publish events', icon: CalendarDays },
        { to: '/competitions', label: 'Competitions', desc: 'Teams, submissions & judging', icon: Trophy },
        { to: '/projects', label: 'Projects', desc: 'Internal & academy projects', icon: FolderKanban },
        { to: '/tasks', label: 'Tasks', desc: 'Task boards & work logs', icon: CheckSquare },
        { to: '/certificates', label: 'Certificates', desc: 'Issue & verify certificates', icon: Award },
      ],
    },
  ],
  COORDINATOR: [
    {
      group: 'Overview',
      icon: LayoutDashboard,
      subtitle: 'Dashboard • Notifications',
      description: 'Your batch overview and latest updates',
      items: [
        { to: '/dashboard', label: 'Dashboard', desc: 'Assigned courses, sessions & Kanban board', icon: LayoutDashboard },
        { to: '/notifications', label: 'Notifications', desc: 'Forwarded approvals & alerts', icon: Bell, badgeKey: 'unreadNotifications' },
      ],
    },
    {
      group: 'Requests & Finance',
      icon: IndianRupee,
      subtitle: 'Leaves • Finance & Dues',
      description: 'Handle 2-day leaves, forward 3+ day leaves & due decisions',
      items: [
        { to: '/leaves', label: 'Leave Management', desc: 'Approve or reject 2-day student leaves', icon: GitBranch },
        { to: '/finance', label: 'Finance & Dues', desc: 'Forward due requests & decisions', icon: IndianRupee },
      ],
    },
    {
      group: 'Academy Management',
      icon: BookOpen,
      subtitle: 'Courses • Batches • Students',
      description: 'Coordinate courses, batches, students, and enrolments',
      items: [
        { to: '/courses', label: 'My Courses', desc: 'Course catalog & fee lock', icon: BookOpen },
        { to: '/batches', label: 'Batches', desc: 'Batch progress & mentors', icon: Layers },
        { to: '/students', label: 'Students', desc: 'Enrolled student directory', icon: GraduationCap },
        { to: '/enrollments', label: 'Enrolments', desc: 'Unlock fees & monitor requests', icon: ClipboardCheck },
        { to: '/attendance', label: 'Attendance', desc: 'Track batch attendance', icon: CalendarCheck },
      ],
    },
    {
      group: 'Events & Outcomes',
      icon: Trophy,
      subtitle: 'Events • Certs • Reports',
      description: 'Run competitions, issue certificates, and review reports',
      items: [
        { to: '/events', label: 'Events', desc: 'Manage event registrations', icon: CalendarDays },
        { to: '/competitions', label: 'Competitions', desc: 'Evaluate teams & results', icon: Trophy },
        { to: '/certificates', label: 'Certificates', desc: 'Request student certificates', icon: Award },
        { to: '/reports', label: 'Reports', desc: 'Academy & attendance reports', icon: BarChart3 },
      ],
    },
  ],
  MENTOR: [
    {
      group: 'Overview',
      icon: LayoutDashboard,
      subtitle: 'Dashboard • Notifications',
      description: 'Your teaching schedule, attendance, and alerts',
      items: [
        { to: '/dashboard', label: 'Dashboard', desc: 'Batches, schedule & grading queue', icon: LayoutDashboard },
        { to: '/notifications', label: 'Notifications', desc: 'Student requests & updates', icon: Bell, badgeKey: 'unreadNotifications' },
      ],
    },
    {
      group: 'Approvals & Requests',
      icon: GitBranch,
      subtitle: 'Leaves • Due Requests',
      description: 'Approve 1-day leaves, forward 2+ day leaves & due requests',
      items: [
        { to: '/leaves', label: 'Leave Management', desc: 'Approve or reject 1-day student leaves', icon: GitBranch },
        { to: '/finance', label: 'Due Requests', desc: 'Forward student due requests', icon: IndianRupee },
      ],
    },
    {
      group: 'Teaching & Batches',
      icon: Layers,
      subtitle: 'Batches • Students • Grading',
      description: 'Manage batches, assignments, attendance, and study materials',
      items: [
        { to: '/batches', label: 'My Batches', desc: 'Assigned batches & progress', icon: Layers },
        { to: '/students', label: 'Students', desc: 'Student roster & details', icon: GraduationCap },
        { to: '/assignments', label: 'Assignments', desc: 'Create & grade submissions', icon: FileText },
        { to: '/attendance', label: 'Attendance', desc: 'Mark student attendance', icon: CalendarCheck },
        { to: '/courses', label: 'Course', desc: 'Upload weekly learning resources', icon: BookOpen },
      ],
    },
    {
      group: 'Work & Recognition',
      icon: Award,
      subtitle: 'Tasks • Certificates',
      description: 'Track tasks and nominate students for certificates',
      items: [
        { to: '/tasks', label: 'Tasks', desc: 'Mentor tasks & work logs', icon: CheckSquare },
        { to: '/certificates', label: 'Certificates', desc: 'Nominate course completions', icon: Award },
      ],
    },
  ],
  STUDENT: [
    {
      group: 'Overview',
      icon: LayoutDashboard,
      subtitle: 'Dashboard • Notifications',
      description: 'Your learning summary and recent notifications',
      items: [
        { to: '/dashboard', label: 'Dashboard', desc: 'Course progress & upcoming events', icon: LayoutDashboard },
        { to: '/notifications', label: 'Notifications', desc: 'Leave, fee & course updates', icon: Bell, badgeKey: 'unreadNotifications' },
      ],
    },
    {
      group: 'Academics',
      icon: BookOpen,
      subtitle: 'Courses • Assignments • Attendance',
      description: 'Explore courses, track enrolments, and submit assignments',
      items: [
        { to: '/courses', label: 'Course Catalog', desc: 'Browse courses & materials', icon: BookOpen },
        { to: '/enrollments', label: 'My Enrolments', desc: 'Track enrolment status & fees', icon: ClipboardCheck },
        { to: '/assignments', label: 'Assignments', desc: 'Submit work & view grades', icon: FileText },
        { to: '/attendance', label: 'Attendance', desc: 'View your session attendance', icon: CalendarCheck },
      ],
    },
    {
      group: 'Leave & Fee Due',
      icon: Wallet,
      subtitle: 'Leave Management • Fees & Dues',
      description: 'Submit leave requests, pay invoices, or request due approval',
      items: [
        { to: '/leaves', label: 'Leave Management', desc: 'Apply & track leave status', icon: GitBranch },
        { to: '/finance', label: 'Fees & Dues', desc: 'Invoices, payments & due requests', icon: IndianRupee },
      ],
    },
    {
      group: 'Events & Achievements',
      icon: Award,
      subtitle: 'Events • Certificates',
      description: 'Join CraffixWeb events and download verified certificates',
      items: [
        { to: '/events', label: 'Events', desc: 'Register for hackathons & workshops', icon: CalendarDays },
        { to: '/certificates', label: 'Certificates', desc: 'Download & verify certificates', icon: Award },
      ],
    },
  ],
  GUEST: [
    {
      group: 'Overview',
      icon: LayoutDashboard,
      subtitle: 'Dashboard • Notifications',
      description: 'Event pass status and notifications',
      items: [
        { to: '/dashboard', label: 'Dashboard', desc: 'Participation progress tracker', icon: LayoutDashboard },
        { to: '/notifications', label: 'Notifications', desc: 'Submission & pitch updates', icon: Bell, badgeKey: 'unreadNotifications' },
      ],
    },
    {
      group: 'Event & Innovation',
      icon: Lightbulb,
      subtitle: 'Pitches • Event • Submissions',
      description: 'Pitch ideas, manage event participation, and check results',
      items: [
        { to: '/idea-pitching', label: 'Idea Pitching', desc: 'Submit & track your idea pitch', icon: Lightbulb },
        { to: '/events', label: 'My Event', desc: 'Event schedule & venue info', icon: CalendarDays },
        { to: '/competitions', label: 'Submissions', desc: 'Team & project submissions', icon: Upload },
        { to: '/competitions?tab=results', label: 'Results', desc: 'Competition leaderboard', icon: Trophy },
      ],
    },
    {
      group: 'Achievements',
      icon: Award,
      subtitle: 'Certificate',
      description: 'Download your event participation certificate',
      items: [
        { to: '/certificates', label: 'Certificate', desc: 'Verified participation certificate', icon: Award },
      ],
    },
  ],
};
