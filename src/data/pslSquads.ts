// Fallback PSL 2026 squad data for when the API is unreachable
// Credits are default estimates; roles based on known player profiles

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
  'Lahore Qalandars': squad('Lahore Qalandars', [
    ['Shaheen Afridi', 'BOWL', 10],
    ['Fakhar Zaman', 'BAT', 9.5],
    ['Mohammad Hafeez', 'AR', 8.5],
    ['Rashid Khan', 'BOWL', 10],
    ['Haris Rauf', 'BOWL', 9],
    ['Abdullah Shafique', 'BAT', 8],
    ['Sikandar Raza', 'AR', 8],
    ['Zaman Khan', 'BOWL', 7.5],
    ['Mirza Tahir Baig', 'BAT', 6.5],
    ['Kamran Ghulam', 'BAT', 7],
    ['Ben Dunk', 'WK', 7.5],
    ['Samit Patel', 'AR', 7],
    ['David Wiese', 'AR', 8],
    ['Dilbar Hussain', 'BOWL', 6.5],
    ['Ahmed Daniyal', 'BOWL', 6],
  ]),
  'Karachi Kings': squad('Karachi Kings', [
    ['Babar Azam', 'BAT', 10.5],
    ['James Vince', 'BAT', 8.5],
    ['Imad Wasim', 'AR', 8.5],
    ['Mohammad Amir', 'BOWL', 9],
    ['Sharjeel Khan', 'BAT', 8],
    ['Joe Clarke', 'WK', 7.5],
    ['Chris Jordan', 'BOWL', 8],
    ['Umaid Asif', 'BOWL', 6.5],
    ['Qasim Akram', 'AR', 7],
    ['Aamir Yamin', 'BOWL', 6.5],
    ['Irfan Khan', 'BAT', 6],
    ['Mohammad Ilyas', 'BOWL', 6],
    ['Sahibzada Farhan', 'BAT', 6.5],
    ['Rohail Nazir', 'WK', 6],
    ['Abbas Afridi', 'BOWL', 7],
  ]),
  'Islamabad United': squad('Islamabad United', [
    ['Shadab Khan', 'AR', 9.5],
    ['Alex Hales', 'BAT', 9],
    ['Azam Khan', 'WK', 7.5],
    ['Naseem Shah', 'BOWL', 9],
    ['Colin Munro', 'BAT', 8],
    ['Faheem Ashraf', 'AR', 8],
    ['Rumman Raees', 'BOWL', 7],
    ['Liam Dawson', 'AR', 7.5],
    ['Musa Khan', 'BOWL', 6.5],
    ['Rahmanullah Gurbaz', 'WK', 8.5],
    ['Paul Stirling', 'BAT', 8],
    ['Hussain Talat', 'BAT', 6.5],
    ['Hasan Ali', 'BOWL', 8.5],
    ['Muhammad Waseem Jr', 'BAT', 6],
    ['Zafar Gohar', 'BOWL', 7],
  ]),
  'Peshawar Zalmi': squad('Peshawar Zalmi', [
    ['Wahab Riaz', 'BOWL', 8],
    ['Shoaib Malik', 'AR', 8],
    ['Haider Ali', 'BAT', 7.5],
    ['Tom Kohler-Cadmore', 'BAT', 8],
    ['Liam Livingstone', 'AR', 9],
    ['Mohammad Nawaz', 'AR', 8.5],
    ['Sherfane Rutherford', 'BAT', 7.5],
    ['Salman Irshad', 'BOWL', 7],
    ['Arshad Iqbal', 'BOWL', 7],
    ['Mohammad Haris', 'WK', 7.5],
    ['Saim Ayub', 'BAT', 8],
    ['Ihsanullah', 'BOWL', 7.5],
    ['Yasir Khan', 'BAT', 6],
    ['Ben Cutting', 'AR', 7],
    ['Aamer Jamal', 'AR', 7.5],
  ]),
  'Quetta Gladiators': squad('Quetta Gladiators', [
    ['Sarfaraz Ahmed', 'WK', 8],
    ['Jason Roy', 'BAT', 9],
    ['Mohammad Wasim Jr', 'BOWL', 8],
    ['Iftikhar Ahmed', 'AR', 8],
    ['Usman Khan', 'BAT', 7],
    ['Naseem Shah', 'BOWL', 9],
    ['James Faulkner', 'AR', 7.5],
    ['Ahsan Ali', 'BAT', 6.5],
    ['Noor Ahmad', 'BOWL', 7],
    ['Khurram Shahzad', 'BOWL', 7],
    ['Saud Shakeel', 'BAT', 8],
    ['Will Smeed', 'BAT', 7.5],
    ['Hassan Khan', 'AR', 6.5],
    ['Mohammad Hasnain', 'BOWL', 7.5],
    ['Omair Yousuf', 'BAT', 6],
  ]),
  'Multan Sultans': squad('Multan Sultans', [
    ['Mohammad Rizwan', 'WK', 10],
    ['Shan Masood', 'BAT', 8.5],
    ['Tim David', 'BAT', 9],
    ['Imran Tahir', 'BOWL', 8],
    ['Khushdil Shah', 'AR', 7],
    ['Abbas Afridi', 'BOWL', 7],
    ['David Miller', 'BAT', 9],
    ['Usama Mir', 'BOWL', 7.5],
    ['Johnson Charles', 'BAT', 7.5],
    ['Blessing Muzarabani', 'BOWL', 8],
    ['Ihsanullah', 'BOWL', 7.5],
    ['Rilee Rossouw', 'BAT', 8.5],
    ['Anwar Ali', 'AR', 6.5],
    ['Shahnawaz Dahani', 'BOWL', 7.5],
    ['Mohammad Ali', 'BOWL', 6.5],
  ]),
  'Hyderabad Kingsmen': squad('Hyderabad Kingsmen', [
    ['Rassie van der Dussen', 'BAT', 9],
    ['Usman Qadir', 'BOWL', 7],
    ['Asif Ali', 'BAT', 7.5],
    ['Luke Wood', 'BOWL', 7.5],
    ['Imam ul Haq', 'BAT', 8],
    ['Sohaib Maqsood', 'BAT', 7],
    ['Junaid Khan', 'BOWL', 7],
    ['Tayyab Tahir', 'BAT', 7],
    ['Mohammad Irfan', 'BOWL', 6.5],
    ['Danish Aziz', 'AR', 6.5],
    ['Bismillah Khan', 'WK', 7],
    ['Chris Lynn', 'BAT', 8],
    ['Amad Butt', 'AR', 6.5],
    ['Naveen ul Haq', 'BOWL', 8],
    ['Agha Salman', 'AR', 7.5],
  ]),
  'Rawalpindi Pindiz': squad('Rawalpindi Pindiz', [
    ['Ahmed Shahzad', 'BAT', 7],
    ['Rumman Raees', 'BOWL', 7],
    ['Dawid Malan', 'BAT', 8.5],
    ['Wanindu Hasaranga', 'AR', 9],
    ['Mohammad Wasim', 'BOWL', 7.5],
    ['Danyal Sohail', 'BAT', 6],
    ['Akeal Hosein', 'BOWL', 7.5],
    ['Kamran Akmal', 'WK', 7],
    ['Sam Billings', 'WK', 7.5],
    ['Zahid Mahmood', 'BOWL', 6.5],
    ['Salman Ali Agha', 'AR', 7.5],
    ['Fazalhaq Farooqi', 'BOWL', 8.5],
    ['Reece Topley', 'BOWL', 7.5],
    ['Devon Conway', 'BAT', 8.5],
    ['Saad Baig', 'WK', 6],
  ]),
};

// Get fallback players for both teams in a match
export const getFallbackPlayers = (teamA: string, teamB: string): FallbackPlayer[] => {
  const playersA = PSL_SQUADS[teamA] || [];
  const playersB = PSL_SQUADS[teamB] || [];
  return [...playersA, ...playersB];
};
