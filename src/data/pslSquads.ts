// PSL 2026 squad data — updated with trade window moves, withdrawals & replacements (March 27, 2026)

type PlayerRole = 'BAT' | 'BOWL' | 'AR' | 'WK';

export interface FallbackPlayer {
  name: string;
  team: string;
  role: PlayerRole;
  credits: number;
  image_url?: string;
}

// Map Cricbuzz roles to our simplified roles
const mapRole = (cbRole: string): PlayerRole => {
  if (cbRole.includes('WK')) return 'WK';
  if (cbRole.includes('Bowling Allrounder')) return 'AR';
  if (cbRole.includes('Batting Allrounder')) return 'AR';
  if (cbRole.includes('Allrounder')) return 'AR';
  if (cbRole.includes('Bowler')) return 'BOWL';
  return 'BAT';
};

// Credit assignment: stars 9-10.5, mid-tier 7.5-8.5, squad players 6-7
const starPlayers: Record<string, number> = {
  'Mohammad Rizwan': 10.5, 'Babar Azam': 10.5, 'Shaheen Afridi': 10,
  'David Warner': 10, 'Shadab Khan': 9.5, 'Naseem Shah': 9.5,
  'Fakhar Zaman': 9.5, 'Haris Rauf': 9, 'Marnus Labuschagne': 9.5,
  'Steven Smith': 9.5, 'Moeen Ali': 9, 'Devon Conway': 9,
  'Rilee Rossouw': 9, 'Saim Ayub': 9, 'Saud Shakeel': 9,
  'Imad Wasim': 8.5, 'Faheem Ashraf': 8, 'Mohammad Nawaz': 8.5,
  'Shan Masood': 8.5, 'Abdullah Shafique': 8.5, 'Mustafizur Rahman': 8.5,
  'Adam Zampa': 8, 'Hasan Ali': 8.5, 'Abbas Afridi': 7.5,
  'Daryl Mitchell': 9, 'Sam Billings': 8, 'Kusal Mendis': 8.5,
  'James Vince': 8.5, 'Alzarri Joseph': 8.5, 'Tom Curran': 8,
  'Ben McDermott': 8, 'Abrar Ahmed': 8, 'Sikandar Raza': 8,
  'Usama Mir': 7.5, 'Tabraiz Shamsi': 8, 'Ashton Turner': 8,
  'Josh Philippe': 7.5, 'Azam Khan': 7.5, 'Iftikhar Ahmed': 8,
  'Aaron Hardie': 8, 'Shahnawaz Dahani': 8, 'Kamran Ghulam': 8,
  'Mohammad Amir': 8.5, 'Mohammad Hasnain': 7.5, 'Haider Ali': 7.5,
  'Kusal Perera': 8, 'Sharjeel Khan': 7.5, 'Salman Agha': 8,
  'Khurram Shahzad': 7.5, 'Asif Ali': 7.5, 'Hussain Talat': 7,
  'Mohammad Haris': 7.5, 'Aamer Jamal': 7.5, 'Mark Chapman': 8,
  'Reeza Hendricks': 8, 'Dunith Wellalage': 8, 'Gudakesh Motie': 7.5,
  'Peter Siddle': 7.5, 'Riley Meredith': 7.5, 'Shamar Joseph': 8,
  'Nahid Rana': 7.5, 'Sufiyan Muqeem': 7.5, 'Mohammad Wasim Jr': 8,
  'Khushdil Shah': 7, 'Dipendra Singh Airee': 7.5,
  // New additions from trade window / replacements
  'Chris Green': 7, 'Daniel Sams': 8, 'Ryan Burl': 7.5,
  'Usman Khawaja': 9, 'Maheesh Theekshana': 8, 'Shoriful Islam': 7.5,
  'Brian Bennett': 7, 'Arafat Minhas': 7, 'Faisal Akram': 6.5,
  'Salman Mirza': 7, 'Cole McConchie': 7,
};

const getCredits = (name: string): number => starPlayers[name] || 6.5;

// Cricbuzz image URL pattern
const getCricbuzzImage = (name: string): string => {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `https://www.cricbuzz.com/a/img/v1/75x75/i1/c${slug}/image.jpg`;
};

interface RawPlayer { name: string; role: string; }

const buildSquad = (team: string, raw: RawPlayer[]): FallbackPlayer[] =>
  raw.map(p => {
    const cleanName = p.name.replace(/\s*\(Captain\)\s*/i, '').trim();
    return {
      name: cleanName,
      team,
      role: mapRole(p.role),
      credits: getCredits(cleanName),
      image_url: getCricbuzzImage(cleanName),
    };
  });

export const PSL_SQUADS: Record<string, FallbackPlayer[]> = {
  'Islamabad United': buildSquad('Islamabad United', [
    { name: 'Shadab Khan (Captain)', role: 'Bowling Allrounder' },
    { name: 'Devon Conway', role: 'WK-Batsman' },
    { name: 'Imad Wasim', role: 'Bowling Allrounder' },
    { name: 'Faheem Ashraf', role: 'Bowling Allrounder' },
    { name: 'Haider Ali', role: 'Batsman' },
    { name: 'Mohammad Hasnain', role: 'Bowler' },
    { name: 'Sameer Minhas', role: 'Batsman' },
    { name: 'Mark Chapman', role: 'Batsman' },
    { name: 'Dipendra Singh Airee', role: 'Batting Allrounder' },
    { name: 'Andries Gous', role: 'WK-Batsman' },
    { name: 'Richard Gleeson', role: 'Bowler' },
    { name: 'Shamar Joseph', role: 'Bowler' },
    { name: 'Mehran Mumtaz', role: 'Bowler' },
    { name: 'Salman Irshad', role: 'Bowler' },
    { name: 'Sameen Gul', role: 'Bowler' },
    { name: 'Hamza Sajjad', role: 'Bowler' },
    // New: trades & replacements
    { name: 'Salman Mirza', role: 'Bowler' },
    { name: 'Nisar Ahmed', role: 'Bowler' },
    { name: 'Chris Green', role: 'Bowling Allrounder' },
    { name: 'Mohsin Riaz', role: 'Bowler' },
  ]),
  'Karachi Kings': buildSquad('Karachi Kings', [
    { name: 'David Warner (Captain)', role: 'Batsman' },
    { name: 'Moeen Ali', role: 'Batting Allrounder' },
    { name: 'Hasan Ali', role: 'Bowler' },
    { name: 'Abbas Afridi', role: 'Bowler' },
    { name: 'Adam Zampa', role: 'Bowler' },
    { name: 'Azam Khan', role: 'WK-Batsman' },
    { name: 'Salman Agha', role: 'Batting Allrounder' },
    { name: 'Aqib Ilyas', role: 'Batsman' },
    { name: 'Muhammad Waseem', role: 'Batsman' },
    { name: 'Reeza Hendricks', role: 'Batsman' },
    { name: 'Haroon Arshad', role: 'Batsman' },
    { name: 'Shahid Aziz', role: 'Batting Allrounder' },
    { name: 'Khushdil Shah', role: 'Batting Allrounder' },
    { name: 'Saad Baig', role: 'WK-Batsman' },
    { name: 'Ihsanullah', role: 'Bowler' },
    { name: 'Khuzaima Tanveer', role: 'Bowler' },
    { name: 'Mir Hamza', role: 'Bowler' },
    { name: 'Rizwanullah', role: 'Bowler' },
    { name: 'Mohammad Hamza', role: 'Bowler' },
  ]),
  'Lahore Qalandars': buildSquad('Lahore Qalandars', [
    { name: 'Shaheen Afridi', role: 'Bowler' },
    { name: 'Fakhar Zaman', role: 'Batsman' },
    { name: 'Abdullah Shafique', role: 'Batsman' },
    { name: 'Haris Rauf', role: 'Bowler' },
    { name: 'Mustafizur Rahman', role: 'Bowler' },
    { name: 'Sikandar Raza', role: 'Batting Allrounder' },
    { name: 'Usama Mir', role: 'Bowler' },
    { name: 'Asif Ali', role: 'Batsman' },
    { name: 'Tayyab Tahir', role: 'Batsman' },
    { name: 'Mohammad Naeem', role: 'Batsman' },
    { name: 'Mohammad Farooq', role: 'Batsman' },
    { name: 'Hussain Talat', role: 'Batting Allrounder' },
    { name: 'Dunith Wellalage', role: 'Bowling Allrounder' },
    { name: 'Haseebullah Khan', role: 'WK-Batsman' },
    { name: 'Parvez Hossain Emon', role: 'WK-Batsman' },
    { name: 'Rubin Hermann', role: 'WK-Batsman' },
    { name: 'Ubaid Shah', role: 'Bowler' },
    // New replacements
    { name: 'Daniel Sams', role: 'Bowling Allrounder' },
    { name: 'Shahab Khan', role: 'Bowler' },
    { name: 'Ryan Burl', role: 'Batting Allrounder' },
  ]),
  'Peshawar Zalmi': buildSquad('Peshawar Zalmi', [
    { name: 'Babar Azam (Captain)', role: 'Batsman' },
    { name: 'James Vince', role: 'Batsman' },
    { name: 'Kusal Mendis', role: 'WK-Batsman' },
    { name: 'Aaron Hardie', role: 'Batting Allrounder' },
    { name: 'Iftikhar Ahmed', role: 'Batting Allrounder' },
    { name: 'Shahnawaz Dahani', role: 'Bowler' },
    { name: 'Mohammad Haris', role: 'WK-Batsman' },
    { name: 'Aamer Jamal', role: 'Bowling Allrounder' },
    { name: 'Abdul Samad', role: 'Batsman' },
    { name: 'Tanzid Hasan Tamim', role: 'Batsman' },
    { name: 'Michael Bracewell', role: 'Batting Allrounder' },
    { name: 'Khalid Usman', role: 'Bowling Allrounder' },
    { name: 'Abdul Subhan', role: 'Bowler' },
    { name: 'Ali Raza', role: 'Bowler' },
    { name: 'Kashif Ali', role: 'Bowler' },
    { name: 'Nahid Rana', role: 'Bowler' },
    { name: 'Sufiyan Muqeem', role: 'Bowler' },
    { name: 'Khurram Shahzad', role: 'Bowler' },
    // New additions
    { name: 'Farhan Yousuf', role: 'Batsman' },
    { name: 'Shoriful Islam', role: 'Bowler' },
    { name: 'Brian Bennett', role: 'Batting Allrounder' },
  ]),
  'Quetta Gladiators': buildSquad('Quetta Gladiators', [
    { name: 'Saud Shakeel', role: 'Batting Allrounder' },
    { name: 'Rilee Rossouw', role: 'Batsman' },
    { name: 'Alzarri Joseph', role: 'Bowler' },
    { name: 'Tom Curran', role: 'Bowling Allrounder' },
    { name: 'Ben McDermott', role: 'WK-Batsman' },
    { name: 'Abrar Ahmed', role: 'Bowler' },
    { name: 'Hasan Nawaz', role: 'Batsman' },
    { name: 'Bevon Jacobs', role: 'Batsman' },
    { name: 'Shamyl Hussain', role: 'Batsman' },
    { name: 'Ahsan Ali', role: 'Batsman' },
    { name: 'Jahandad Khan', role: 'Bowling Allrounder' },
    { name: 'Brett Hampton', role: 'Bowling Allrounder' },
    { name: 'Bismillah Khan', role: 'WK-Batsman' },
    { name: 'Sam Harper', role: 'WK-Batsman' },
    { name: 'Khawaja Nafay', role: 'WK-Batsman' },
    { name: 'Usman Tariq', role: 'Bowler' },
    { name: 'Wasim Akram', role: 'Bowler' },
    { name: 'Khan Zaib', role: 'Bowler' },
    { name: 'Saqib Khan', role: 'Bowler' },
    // Traded IN from Multan
    { name: 'Ahmad Daniyal', role: 'Bowler' },
    { name: 'Jahanzaib Sultan', role: 'Batsman' },
  ]),
  'Hyderabad Kingsmen': buildSquad('Hyderabad Kingsmen', [
    { name: 'Marnus Labuschagne', role: 'Batsman' },
    { name: 'Saim Ayub', role: 'Batting Allrounder' },
    { name: 'Kusal Perera', role: 'WK-Batsman' },
    { name: 'Sharjeel Khan', role: 'Batsman' },
    { name: 'Hammad Azam', role: 'Batsman' },
    { name: 'Syed Saad Ali', role: 'Batsman' },
    { name: 'Shayan Jahangir', role: 'Batsman' },
    { name: 'Rizwan Mehmood', role: 'Batsman' },
    { name: 'Mohammad Tayyab Arif', role: 'Batsman' },
    { name: 'Irfan Khan', role: 'Batting Allrounder' },
    { name: 'Maaz Sadaqat', role: 'Batting Allrounder' },
    { name: 'Hassan Khan', role: 'Bowling Allrounder' },
    { name: 'Usman Khan', role: 'WK-Batsman' },
    { name: 'Akif Javed', role: 'Bowler' },
    { name: 'Asif Mehmood', role: 'Bowler' },
    { name: 'Hunain Shah', role: 'Bowler' },
    { name: 'Riley Meredith', role: 'Bowler' },
    { name: 'Mohammad Ali', role: 'Bowler' },
    // New addition
    { name: 'Maheesh Theekshana', role: 'Bowler' },
  ]),
  'Rawalpindi Pindiz': buildSquad('Rawalpindi Pindiz', [
    { name: 'Mohammad Rizwan (Captain)', role: 'WK-Batsman' },
    { name: 'Sam Billings', role: 'WK-Batsman' },
    { name: 'Naseem Shah', role: 'Bowler' },
    { name: 'Daryl Mitchell', role: 'Batting Allrounder' },
    { name: 'Kamran Ghulam', role: 'Batting Allrounder' },
    { name: 'Mohammad Amir', role: 'Bowler' },
    { name: 'Abdullah Fazal', role: 'Batsman' },
    { name: 'Shahzaib Khan', role: 'Batsman' },
    { name: 'Yasir Khan', role: 'Batsman' },
    { name: 'Dian Forrester', role: 'Batting Allrounder' },
    { name: 'Amad Butt', role: 'Bowling Allrounder' },
    { name: 'Asif Afridi', role: 'Bowling Allrounder' },
    { name: 'Cole McConchie', role: 'Bowling Allrounder' },
    { name: 'Rishad Hossain', role: 'Bowler' },
    { name: 'Fawad Ali', role: 'Bowler' },
    { name: 'Mohammad Amir Khan', role: 'Bowler' },
    // New: replacements & trades
    { name: 'Saad Masood', role: 'Batting Allrounder' },
    { name: 'Jalat Khan', role: 'Bowler' },
    { name: 'Usman Khawaja', role: 'Batsman' },
  ]),
  'Multan Sultans': buildSquad('Multan Sultans', [
    { name: 'Ashton Turner', role: 'Batting Allrounder' },
    { name: 'Steven Smith', role: 'Batsman' },
    { name: 'Shan Masood', role: 'Batsman' },
    { name: 'Mohammad Nawaz', role: 'Bowling Allrounder' },
    { name: 'Tabraiz Shamsi', role: 'Bowler' },
    { name: 'Josh Philippe', role: 'WK-Batsman' },
    { name: 'Awais Zafar', role: 'Batsman' },
    { name: 'Sahibzada Farhan', role: 'Batsman' },
    { name: 'Delano Potgieter', role: 'Batting Allrounder' },
    { name: 'Muhammad Shahzad', role: 'Batting Allrounder' },
    { name: 'Lachlan Shaw', role: 'WK-Batsman' },
    { name: 'Momin Qamar', role: 'Bowler' },
    { name: 'Peter Siddle', role: 'Bowler' },
    { name: 'Muhammad Ismail', role: 'Bowler' },
    { name: 'Arshad Iqbal', role: 'Bowler' },
    // Traded IN
    { name: 'Arafat Minhas', role: 'Batting Allrounder' },
    { name: 'Faisal Akram', role: 'Bowling Allrounder' },
    { name: 'Mohammad Wasim Jr', role: 'Bowler' },
    // New additions
    { name: 'Shehzad Gul', role: 'Bowler' },
    { name: 'Imran Randhawa', role: 'Bowler' },
    { name: 'Atizaz Habib Khan', role: 'Batting Allrounder' },
  ]),
};

// Get fallback players for both teams in a match
export const getFallbackPlayers = (teamA: string, teamB: string): FallbackPlayer[] => {
  const playersA = PSL_SQUADS[teamA] || [];
  const playersB = PSL_SQUADS[teamB] || [];
  return [...playersA, ...playersB];
};
