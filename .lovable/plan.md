

## Plan: Update PSL 2026 Squads to Actual Rosters

### Problem
The `pslSquads.ts` file contains outdated/fictional player assignments from previous PSL seasons. Many players are on wrong teams or retired.

### Source
Wisden's official PSL 2026 squad list (published March 25, 2026) provides the correct rosters for all 8 teams.

### Changes

**File: `src/data/pslSquads.ts`** — Replace all 8 team squads with the actual PSL 2026 rosters:

| Team | Captain | Key Players |
|------|---------|-------------|
| **Rawalpindi Pindiz** | Mohammad Rizwan | Sam Billings, Naseem Shah, Daryl Mitchell, Kamran Ghulam |
| **Peshawar Zalmi** | Babar Azam | James Vince, Kusal Mendis, Aaron Hardie, Iftikhar Ahmed, Shahnawaz Dahani |
| **Quetta Gladiators** | Saud Shakeel | Rilee Rossouw, Alzarri Joseph, Tom Curran, Ben McDermott, Abrar Ahmed |
| **Multan Sultans** | Ashton Turner | Steve Smith, Shan Masood, Mohammad Nawaz, Tabraiz Shamsi, Josh Philippe |
| **Karachi Kings** | David Warner | Moeen Ali, Hasan Ali, Abbas Afridi, Adam Zampa, Azam Khan, Salman Ali Agha |
| **Lahore Qalandars** | Shaheen Afridi | Fakhar Zaman, Abdullah Shafique, Haris Rauf, Mustafizur Rahman, Sikandar Raza, Usama Mir |
| **Hyderabad Kingsmen** | Marnus Labuschagne | Saim Ayub, Glenn Maxwell, Kusal Perera, Maheesh Theekshana, Sharjeel Khan |
| **Islamabad United** | Shadab Khan | Devon Conway, Imad Wasim, Faheem Ashraf, Haider Ali, Mohammad Hasnain |

### Role Assignment Logic
- Known keepers (Rizwan, Billings, Azam Khan, Philippe, etc.) → WK
- Known all-rounders (Shadab, Imad, Faheem, Moeen, etc.) → AR
- Known bowlers (Shaheen, Naseem, Haris Rauf, etc.) → BOWL
- Everyone else → BAT
- Credits: 9-10.5 for star players, 7-8.5 for mid-tier, 6-7 for squad players

### Files to Edit
- **`src/data/pslSquads.ts`** — full replacement of all squad arrays with correct 2026 rosters

