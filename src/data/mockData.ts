export type PlayerRole = 'BAT' | 'BOWL' | 'AR' | 'WK';

export interface Player {
  id: string;
  name: string;
  team: string;
  role: PlayerRole;
  credits: number;
  points: number;
  isPlaying: boolean | null; // null = not announced
  imageUrl?: string;
}

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  teamALogo: string;
  teamBLogo: string;
  date: string;
  time: string;
  venue: string;
  status: 'upcoming' | 'live' | 'completed';
  teamAScore?: string;
  teamBScore?: string;
}

export interface League {
  id: string;
  name: string;
  code: string;
  members: number;
  prize: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  avatar?: string;
}

export const PSL_TEAMS = [
  'Lahore Qalandars',
  'Islamabad United',
  'Karachi Kings',
  'Peshawar Zalmi',
  'Quetta Gladiators',
  'Multan Sultans',
];

export const MATCHES: Match[] = [
  {
    id: '1',
    teamA: 'Lahore Qalandars',
    teamB: 'Karachi Kings',
    teamALogo: 'LQ',
    teamBLogo: 'KK',
    date: '2026-03-28',
    time: '19:00',
    venue: 'Gaddafi Stadium, Lahore',
    status: 'upcoming',
  },
  {
    id: '2',
    teamA: 'Islamabad United',
    teamB: 'Peshawar Zalmi',
    teamALogo: 'IU',
    teamBLogo: 'PZ',
    date: '2026-03-27',
    time: '14:00',
    venue: 'Rawalpindi Cricket Stadium',
    status: 'live',
    teamAScore: '178/4 (18.2)',
    teamBScore: '92/3 (11.0)',
  },
  {
    id: '3',
    teamA: 'Multan Sultans',
    teamB: 'Quetta Gladiators',
    teamALogo: 'MS',
    teamBLogo: 'QG',
    date: '2026-03-26',
    time: '19:00',
    venue: 'Multan Cricket Stadium',
    status: 'completed',
    teamAScore: '195/5 (20.0)',
    teamBScore: '172/8 (20.0)',
  },
  {
    id: '4',
    teamA: 'Peshawar Zalmi',
    teamB: 'Lahore Qalandars',
    teamALogo: 'PZ',
    teamBLogo: 'LQ',
    date: '2026-03-29',
    time: '19:00',
    venue: 'Arbab Niaz Stadium, Peshawar',
    status: 'upcoming',
  },
];

const generatePlayers = (team: string, offset: number): Player[] => {
  const names: Record<string, string[]> = {
    'Lahore Qalandars': ['Shaheen Afridi', 'Fakhar Zaman', 'Rashid Khan', 'Abdullah Shafique', 'Haris Rauf', 'Sikandar Raza', 'Zaman Khan', 'David Wiese', 'Kamran Ghulam', 'Phil Salt', 'Mir Hamza'],
    'Karachi Kings': ['Babar Azam', 'Imad Wasim', 'Sharjeel Khan', 'Mohammad Amir', 'James Vince', 'Aamer Yamin', 'Shan Masood', 'Umaid Asif', 'Qasim Akram', 'Aamir Sohail', 'Irfan Khan'],
    'Islamabad United': ['Shadab Khan', 'Alex Hales', 'Azam Khan', 'Naseem Shah', 'Faheem Ashraf', 'Colin Munro', 'Asif Ali', 'Hasan Ali', 'Muhammad Waseem', 'Liam Dawson', 'Mubasir Khan'],
    'Peshawar Zalmi': ['Wahab Riaz', 'Haider Ali', 'Shoaib Malik', 'Tom Kohler-Cadmore', 'Mohammad Haris', 'Saim Ayub', 'Arshad Iqbal', 'Salman Irshad', 'Luke Wood', 'Rovman Powell', 'Mehran Mumtaz'],
    'Quetta Gladiators': ['Sarfaraz Ahmed', 'Jason Roy', 'Iftikhar Ahmed', 'Naseem Shah', 'Khurram Shahzad', 'Will Smeed', 'Mohammad Nawaz', 'Saud Shakeel', 'Akeal Hosein', 'Usman Khan', 'Omair Yousuf'],
    'Multan Sultans': ['Mohammad Rizwan', 'Tim David', 'Rilee Rossouw', 'Ihsanullah', 'Usama Mir', 'Abbas Afridi', 'Shan Masood', 'Johnson Charles', 'David Willey', 'Khushdil Shah', 'Blessing Muzarabani'],
  };

  const roles: PlayerRole[] = ['WK', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BAT', 'BOWL'];
  const credits = [10, 9.5, 9, 8.5, 8, 7.5, 7, 7, 6.5, 6, 5.5];

  const teamNames = names[team] || names['Lahore Qalandars'];
  return teamNames.map((name, i) => ({
    id: `p${offset + i}`,
    name,
    team,
    role: roles[i],
    credits: credits[i],
    points: Math.floor(Math.random() * 120),
    isPlaying: i < 11 ? (Math.random() > 0.2 ? true : null) : false,
  }));
};

export const PLAYERS: Record<string, Player[]> = {
  'Lahore Qalandars': generatePlayers('Lahore Qalandars', 0),
  'Karachi Kings': generatePlayers('Karachi Kings', 20),
  'Islamabad United': generatePlayers('Islamabad United', 40),
  'Peshawar Zalmi': generatePlayers('Peshawar Zalmi', 60),
  'Quetta Gladiators': generatePlayers('Quetta Gladiators', 80),
  'Multan Sultans': generatePlayers('Multan Sultans', 100),
};

export const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: 'CricketKing99', points: 2450 },
  { rank: 2, username: 'PSLFanatic', points: 2380 },
  { rank: 3, username: 'ShaheenArmy', points: 2310 },
  { rank: 4, username: 'BabarFan', points: 2290 },
  { rank: 5, username: 'ZalmiZindabad', points: 2180 },
  { rank: 6, username: 'QalandarPower', points: 2100 },
  { rank: 7, username: 'SultanSquad', points: 2050 },
  { rank: 8, username: 'UnitedForce', points: 1980 },
  { rank: 9, username: 'GladiatorFan', points: 1920 },
  { rank: 10, username: 'KingsCricket', points: 1870 },
];

export const LEAGUES: League[] = [
  { id: '1', name: 'Ultimate PSL League', code: 'UPL2026', members: 128, prize: '₨50,000' },
  { id: '2', name: 'Friends League', code: 'FRD001', members: 8, prize: 'Bragging Rights' },
  { id: '3', name: 'Cricket Experts', code: 'CRK777', members: 45, prize: '₨25,000' },
];

export const ROLE_COLORS: Record<PlayerRole, string> = {
  BAT: 'bg-secondary text-secondary-foreground',
  BOWL: 'bg-primary text-primary-foreground',
  AR: 'bg-accent text-accent-foreground',
  WK: 'bg-destructive text-destructive-foreground',
};

export const TEAM_COLORS: Record<string, string> = {
  'Lahore Qalandars': '#E31E24',
  'Karachi Kings': '#005BAC',
  'Islamabad United': '#E31E24',
  'Peshawar Zalmi': '#FCD116',
  'Quetta Gladiators': '#6B2D7B',
  'Multan Sultans': '#00A651',
};
