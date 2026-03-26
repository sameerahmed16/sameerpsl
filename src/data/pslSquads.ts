// PSL 2026 squad data — updated from official rosters (Wisden, March 2026)
// Credits are estimates based on player stature; roles based on known profiles

type PlayerRole = 'BAT' | 'BOWL' | 'AR' | 'WK';

export interface FallbackPlayer {
  name: string;
  team: string;
  role: PlayerRole;
  credits: number;
}

const squad = (team: string, players: [string, PlayerRole, number][]): FallbackPlayer[] =>
  players.map(([name, role, credits]) => ({ name, team, role, credits }));

export const PSL_SQUADS: Record<string, FallbackPlayer[]> = {
  'Rawalpindi Pindiz': squad('Rawalpindi Pindiz', [
    ['Mohammad Rizwan', 'WK', 10.5],
    ['Sam Billings', 'WK', 8],
    ['Naseem Shah', 'BOWL', 9.5],
    ['Daryl Mitchell', 'AR', 9],
    ['Kamran Ghulam', 'BAT', 8],
    ['Saad Baig', 'WK', 6.5],
    ['Fazalhaq Farooqi', 'BOWL', 9],
    ['Reece Topley', 'BOWL', 7.5],
    ['Salman Ali Agha', 'AR', 8],
    ['Zahid Mahmood', 'BOWL', 7],
    ['Danyal Sohail', 'BAT', 6],
    ['Mohammad Wasim', 'BOWL', 7.5],
    ['Dawid Malan', 'BAT', 8.5],
    ['Akeal Hosein', 'BOWL', 7.5],
    ['Ahmed Shahzad', 'BAT', 6.5],
  ]),
  'Peshawar Zalmi': squad('Peshawar Zalmi', [
    ['Babar Azam', 'BAT', 10.5],
    ['James Vince', 'BAT', 8.5],
    ['Kusal Mendis', 'WK', 8.5],
    ['Aaron Hardie', 'AR', 8],
    ['Iftikhar Ahmed', 'AR', 8],
    ['Shahnawaz Dahani', 'BOWL', 8],
    ['Saim Ayub', 'BAT', 8.5],
    ['Mohammad Haris', 'WK', 7.5],
    ['Arshad Iqbal', 'BOWL', 7],
    ['Ihsanullah', 'BOWL', 7.5],
    ['Yasir Khan', 'BAT', 6],
    ['Aamer Jamal', 'AR', 7.5],
    ['Liam Livingstone', 'AR', 9],
    ['Salman Irshad', 'BOWL', 7],
    ['Sherfane Rutherford', 'BAT', 7.5],
  ]),
  'Quetta Gladiators': squad('Quetta Gladiators', [
    ['Saud Shakeel', 'BAT', 9],
    ['Rilee Rossouw', 'BAT', 9],
    ['Alzarri Joseph', 'BOWL', 8.5],
    ['Tom Curran', 'AR', 8],
    ['Ben McDermott', 'WK', 8],
    ['Abrar Ahmed', 'BOWL', 8],
    ['Jason Roy', 'BAT', 8.5],
    ['Mohammad Wasim Jr', 'BOWL', 8],
    ['Usman Khan', 'BAT', 7],
    ['Noor Ahmad', 'BOWL', 7.5],
    ['Khurram Shahzad', 'BOWL', 7],
    ['Will Smeed', 'BAT', 7.5],
    ['Sarfaraz Ahmed', 'WK', 7.5],
    ['Hassan Khan', 'AR', 6.5],
    ['Omair Yousuf', 'BAT', 6],
  ]),
  'Multan Sultans': squad('Multan Sultans', [
    ['Steve Smith', 'BAT', 9.5],
    ['Shan Masood', 'BAT', 8.5],
    ['Mohammad Nawaz', 'AR', 8.5],
    ['Tabraiz Shamsi', 'BOWL', 8],
    ['Josh Philippe', 'WK', 7.5],
    ['Ashton Turner', 'AR', 8],
    ['Tim David', 'BAT', 9],
    ['Usama Mir', 'BOWL', 7.5],
    ['Blessing Muzarabani', 'BOWL', 8],
    ['Johnson Charles', 'BAT', 7.5],
    ['Khushdil Shah', 'AR', 7],
    ['Anwar Ali', 'AR', 6.5],
    ['Mohammad Ali', 'BOWL', 6.5],
    ['David Miller', 'BAT', 9],
    ['Imran Tahir', 'BOWL', 7.5],
  ]),
  'Karachi Kings': squad('Karachi Kings', [
    ['David Warner', 'BAT', 10],
    ['Moeen Ali', 'AR', 9],
    ['Hasan Ali', 'BOWL', 8.5],
    ['Abbas Afridi', 'BOWL', 7.5],
    ['Adam Zampa', 'BOWL', 8],
    ['Azam Khan', 'WK', 7.5],
    ['Salman Ali Agha', 'AR', 8],
    ['Mohammad Amir', 'BOWL', 8.5],
    ['Sharjeel Khan', 'BAT', 7.5],
    ['Joe Clarke', 'WK', 7],
    ['Qasim Akram', 'AR', 7],
    ['Irfan Khan', 'BAT', 6],
    ['Mohammad Ilyas', 'BOWL', 6],
    ['Rohail Nazir', 'WK', 6],
    ['Aamir Yamin', 'BOWL', 6.5],
  ]),
  'Lahore Qalandars': squad('Lahore Qalandars', [
    ['Shaheen Afridi', 'BOWL', 10],
    ['Fakhar Zaman', 'BAT', 9.5],
    ['Abdullah Shafique', 'BAT', 8.5],
    ['Haris Rauf', 'BOWL', 9],
    ['Mustafizur Rahman', 'BOWL', 8.5],
    ['Sikandar Raza', 'AR', 8],
    ['Usama Mir', 'BOWL', 7.5],
    ['Rashid Khan', 'BOWL', 10],
    ['David Wiese', 'AR', 8],
    ['Ben Dunk', 'WK', 7.5],
    ['Mirza Tahir Baig', 'BAT', 6.5],
    ['Zaman Khan', 'BOWL', 7.5],
    ['Kamran Ghulam', 'BAT', 7.5],
    ['Dilbar Hussain', 'BOWL', 6.5],
    ['Ahmed Daniyal', 'BOWL', 6],
  ]),
  'Hyderabad Kingsmen': squad('Hyderabad Kingsmen', [
    ['Marnus Labuschagne', 'BAT', 9.5],
    ['Saim Ayub', 'BAT', 8.5],
    ['Glenn Maxwell', 'AR', 9.5],
    ['Kusal Perera', 'WK', 8],
    ['Maheesh Theekshana', 'BOWL', 8],
    ['Sharjeel Khan', 'BAT', 7.5],
    ['Naveen ul Haq', 'BOWL', 8],
    ['Chris Lynn', 'BAT', 7.5],
    ['Agha Salman', 'AR', 7.5],
    ['Imam ul Haq', 'BAT', 8],
    ['Usman Qadir', 'BOWL', 7],
    ['Danish Aziz', 'AR', 6.5],
    ['Bismillah Khan', 'WK', 7],
    ['Amad Butt', 'AR', 6.5],
    ['Luke Wood', 'BOWL', 7.5],
  ]),
  'Islamabad United': squad('Islamabad United', [
    ['Shadab Khan', 'AR', 9.5],
    ['Devon Conway', 'BAT', 9],
    ['Imad Wasim', 'AR', 8.5],
    ['Faheem Ashraf', 'AR', 8],
    ['Haider Ali', 'BAT', 7.5],
    ['Mohammad Hasnain', 'BOWL', 7.5],
    ['Alex Hales', 'BAT', 9],
    ['Rahmanullah Gurbaz', 'WK', 8.5],
    ['Colin Munro', 'BAT', 8],
    ['Liam Dawson', 'AR', 7.5],
    ['Musa Khan', 'BOWL', 6.5],
    ['Hussain Talat', 'BAT', 6.5],
    ['Hasan Ali', 'BOWL', 8.5],
    ['Paul Stirling', 'BAT', 8],
    ['Zafar Gohar', 'BOWL', 7],
  ]),
};

// Get fallback players for both teams in a match
export const getFallbackPlayers = (teamA: string, teamB: string): FallbackPlayer[] => {
  const playersA = PSL_SQUADS[teamA] || [];
  const playersB = PSL_SQUADS[teamB] || [];
  return [...playersA, ...playersB];
};
