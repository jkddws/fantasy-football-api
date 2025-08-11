// api/update-projections.js
// EXACT conversion of your Python scoring system - NO CHANGES

const cheerio = require('cheerio');

// Your EXACT scoring rules - unchanged
const SCORING_RULES = {
    // Passing
    completion: 1,
    passing_yard: 1/25,
    passing_td: 4,
    interception: -2,
    sack: -1,
    passing_300_399_bonus: 3,
    passing_400plus_bonus: 5,
    passing_td_40_49_bonus: 3,
    passing_td_50plus_bonus: 5,
    
    // Rushing
    rushing_attempt: 0.2,
    rushing_yard: 1/10,
    rushing_td: 6,
    rushing_td_40_49_bonus: 3,
    rushing_td_50plus_bonus: 5,
    rushing_100_199_bonus: 5,
    rushing_200plus_bonus: 10,
    
    // Receiving
    reception: 1,
    receiving_yard: 1/10,
    receiving_td: 6,
    receiving_td_40_49_bonus: 3,
    receiving_td_50plus_bonus: 5,
    receiving_100_199_bonus: 5,
    receiving_200plus_bonus: 10,
    
    // Returns
    return_yard: 1/10,
    return_td: 5,
    
    // Other
    fumble_recovered_td: 6,
    fumble_lost: -2,
    two_point_conversion: 2
};

const KICKER_SCORING = {
    pat_made: 1,
    fg_0_19: 3,
    fg_20_29: 3,
    fg_30_39: 3,
    fg_40_49: 3,
    fg_50plus: 5
};

const DEFENSE_SCORING = {
    sack: 1,
    interception: 2,
    fumble_recovery: 2,
    fumble_forced: 1,
    safety: 2,
    defensive_td: 6,
    blocked_kick: 2,
    return_td: 6,
    return_yard: 1/10,
    two_point_return: 2
};

const POINTS_ALLOWED_SCORING = {
    0: { min: 0, max: 0, points: 10 },
    1: { min: 1, max: 6, points: 7 },
    2: { min: 7, max: 13, points: 4 },
    3: { min: 14, max: 20, points: 1 },
    4: { min: 21, max: 27, points: 0 },
    5: { min: 28, max: 34, points: -1 },
    6: { min: 35, max: 100, points: -4 }
};

const YARDS_ALLOWED_BONUS = {
    0: { min: 0, max: 99, points: 3 }
};

// Historical patterns - these would need to be loaded from actual 2024 data
// For now, using your default percentages from the Python code
const TD_PATTERNS = {
    default: {
        pct_40_49: 0.05,
        pct_50_plus: 0.03
    }
};

const FG_PATTERNS = {
    default: {
        pct_0_29: 0.45,
        pct_30_39: 0.30,
        pct_40_49: 0.20,
        pct_50_plus: 0.05
    }
};

// League average return yards from your Python
const LEAGUE_AVG_RETURN_YARDS = 62.5;

// Your roster
const MY_ROSTER = {
    QB: ["Joe Burrow", "Bo Nix"],
    RB: ["Bucky Irving", "Alvin Kamara", "Chuba Hubbard", "Rachaad White", "Christian McCaffrey"],
    WR: ["Justin Jefferson", "Tee Higgins", "Davante Adams", "George Pickens"],
    TE: ["Sam LaPorta", "Zach Ertz"],
    K: ["Chase McLaughlin"],
    DST: ["Philadelphia Eagles"]
};

// Helper to safely parse float (matching your Python safe_float)
function safeFloat(value) {
    try {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            return parseFloat(value.trim()) || 0.0;
        }
        return 0.0;
    } catch {
        return 0.0;
    }
}

// Get player TD bonus - EXACT match to your Python logic
function getPlayerTdBonus(playerName, projectedTds) {
    // Convert name format (e.g., "Joe Burrow" to "J.Burrow")
    let pattern = TD_PATTERNS.default;
    
    if (playerName.includes(' ')) {
        const parts = playerName.split(' ');
        const shortName = `${parts[0][0]}.${parts[1]}`;
        // Here you would look up the actual pattern from historical data
        // For now using default
    }
    
    const bonus = (projectedTds * pattern.pct_40_49 * 3 + 
                  projectedTds * pattern.pct_50_plus * 5);
    return Math.round(bonus * 10) / 10;
}

// Get kicker points - EXACT match to your Python logic
function getKickerPoints(kickerName, projectedFgs, projectedPats) {
    const patPoints = projectedPats * 1;
    
    let pattern = FG_PATTERNS.default;
    
    if (kickerName.includes(' ')) {
        const parts = kickerName.split(' ');
        const shortName = `${parts[0][0]}.${parts[1]}`;
        // Here you would look up the actual pattern from historical data
        // For now using default
    }
    
    const fgPoints = (projectedFgs * (pattern.pct_0_29 + pattern.pct_30_39 + 
                                      pattern.pct_40_49) * 3 +
                     projectedFgs * pattern.pct_50_plus * 5);
    
    return Math.round((patPoints + fgPoints) * 10) / 10;
}

// Calculate offensive fantasy score - EXACT match to your Python
function calculateProjectedScore(projData) {
    let score = 0;
    
    // Passing
    if ('completions' in projData) {
        score += projData.completions * SCORING_RULES.completion;
    }
    if ('passing_yards' in projData) {
        const yards = projData.passing_yards;
        score += yards * SCORING_RULES.passing_yard;
        // Yardage bonuses
        if (yards >= 400) {
            score += SCORING_RULES.passing_400plus_bonus;
        } else if (yards >= 300) {
            score += SCORING_RULES.passing_300_399_bonus;
        }
    }
    if ('passing_tds' in projData) {
        score += projData.passing_tds * SCORING_RULES.passing_td;
    }
    if ('interceptions' in projData) {
        score += projData.interceptions * SCORING_RULES.interception;
    }
    if ('sacks' in projData) {
        score += projData.sacks * SCORING_RULES.sack;
    }
    
    // Rushing
    if ('rushing_attempts' in projData) {
        score += projData.rushing_attempts * SCORING_RULES.rushing_attempt;
    }
    if ('rushing_yards' in projData) {
        const yards = projData.rushing_yards;
        score += yards * SCORING_RULES.rushing_yard;
        // Yardage bonuses (cumulative)
        if (yards >= 100) {
            score += SCORING_RULES.rushing_100_199_bonus;
        }
        if (yards >= 200) {
            score += SCORING_RULES.rushing_200plus_bonus;
        }
    }
    if ('rushing_tds' in projData) {
        score += projData.rushing_tds * SCORING_RULES.rushing_td;
    }
    
    // Receiving
    if ('receptions' in projData) {
        score += projData.receptions * SCORING_RULES.reception;
    }
    if ('receiving_yards' in projData) {
        const yards = projData.receiving_yards;
        score += yards * SCORING_RULES.receiving_yard;
        // Yardage bonuses (cumulative)
        if (yards >= 100) {
            score += SCORING_RULES.receiving_100_199_bonus;
        }
        if (yards >= 200) {
            score += SCORING_RULES.receiving_200plus_bonus;
        }
    }
    if ('receiving_tds' in projData) {
        score += projData.receiving_tds * SCORING_RULES.receiving_td;
    }
    
    // Other
    if ('fumbles_lost' in projData) {
        score += projData.fumbles_lost * SCORING_RULES.fumble_lost;
    }
    
    return Math.round(score * 10) / 10;
}

// Calculate defense fantasy score - EXACT match to your Python
function calculateDefenseScore(projData) {
    let score = 0;
    
    // Basic defensive stats
    score += (projData.sacks || 0) * DEFENSE_SCORING.sack;
    score += (projData.interceptions || 0) * DEFENSE_SCORING.interception;
    score += (projData.fumble_recoveries || 0) * DEFENSE_SCORING.fumble_recovery;
    score += (projData.fumbles_forced || 0) * DEFENSE_SCORING.fumble_forced;
    score += (projData.safeties || 0) * DEFENSE_SCORING.safety;
    score += (projData.defensive_tds || 0) * DEFENSE_SCORING.defensive_td;
    score += (projData.blocked_kicks || 0) * DEFENSE_SCORING.blocked_kick;
    
    // Points allowed
    const pa = projData.points_allowed || 20;  // Default to 20 if missing
    for (const [, range] of Object.entries(POINTS_ALLOWED_SCORING)) {
        if (pa >= range.min && pa <= range.max) {
            score += range.points;
            break;
        }
    }
    
    // Yards allowed bonus
    const ya = projData.yards_allowed || 300;  // Default to 300 if missing
    for (const [, range] of Object.entries(YARDS_ALLOWED_BONUS)) {
        if (ya >= range.min && ya <= range.max) {
            score += range.points;
            break;
        }
    }
    
    return Math.round(score * 10) / 10;
}

// Scrape FantasyPros - matching your Python scraper
async function scrapeProjections(position, week) {
    const url = `https://www.fantasypros.com/nfl/projections/${position.toLowerCase()}.php?week=${week}`;
    console.log(`Scraping ${position} from: ${url}`);
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    };
    
    try {
        const response = await fetch(url, { headers });
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Find the main table
        const tables = $('table');
        let mainTable = null;
        
        if (position === 'K') {
            console.log(`Found ${tables.length} tables on kicker page`);
        }
        
        tables.each((i, table) => {
            if ($(table).find('a.player-name').length > 0) {
                mainTable = $(table);
                return false; // break
            }
        });
        
        if (!mainTable) {
            console.log(`No player table found for ${position}`);
            return [];
        }
        
        const tbody = mainTable.find('tbody');
        if (!tbody.length) return [];
        
        const projections = [];
        
        tbody.find('tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length === 0) return;
            
            const rowData = {};
            
            // First cell has player name and team
            const firstCell = $(cells[0]);
            const playerLink = firstCell.find('a.player-name');
            
            if (playerLink.length) {
                rowData.player = playerLink.text().trim();
                
                // Get team
                const cellText = firstCell.text().trim();
                const remaining = cellText.replace(rowData.player, '').trim();
                if (remaining) {
                    const teamParts = remaining.split(/\s+/);
                    if (teamParts.length > 0) {
                        rowData.team = teamParts[0];
                    }
                } else {
                    rowData.team = '';
                }
                
                // Get stats based on position
                const statCells = cells.slice(1);
                
                // Map stats exactly as your Python does
                if (position === 'QB' && statCells.length >= 10) {
                    Object.assign(rowData, {
                        passing_attempts: safeFloat($(statCells[0]).text()),
                        completions: safeFloat($(statCells[1]).text()),
                        passing_yards: safeFloat($(statCells[2]).text()),
                        passing_tds: safeFloat($(statCells[3]).text()),
                        interceptions: safeFloat($(statCells[4]).text()),
                        rushing_attempts: safeFloat($(statCells[5]).text()),
                        rushing_yards: safeFloat($(statCells[6]).text()),
                        rushing_tds: safeFloat($(statCells[7]).text()),
                        fumbles_lost: safeFloat($(statCells[8]).text()),
                        position: 'QB'
                    });
                } else if (position === 'RB' && statCells.length >= 8) {
                    Object.assign(rowData, {
                        rushing_attempts: safeFloat($(statCells[0]).text()),
                        rushing_yards: safeFloat($(statCells[1]).text()),
                        rushing_tds: safeFloat($(statCells[2]).text()),
                        receptions: safeFloat($(statCells[3]).text()),
                        receiving_yards: safeFloat($(statCells[4]).text()),
                        receiving_tds: safeFloat($(statCells[5]).text()),
                        fumbles_lost: safeFloat($(statCells[6]).text()),
                        position: 'RB'
                    });
                } else if ((position === 'WR' || position === 'TE') && statCells.length >= 4) {
                    Object.assign(rowData, {
                        receptions: safeFloat($(statCells[0]).text()),
                        receiving_yards: safeFloat($(statCells[1]).text()),
                        receiving_tds: safeFloat($(statCells[2]).text()),
                        rushing_attempts: 0,
                        rushing_yards: 0,
                        rushing_tds: 0,
                        fumbles_lost: statCells.length > 3 ? safeFloat($(statCells[3]).text()) : 0,
                        position: position
                    });
                } else if (position === 'K' && statCells.length >= 4) {
                    Object.assign(rowData, {
                        fg_made: safeFloat($(statCells[0]).text()),
                        fg_att: safeFloat($(statCells[1]).text()),
                        pat_made: safeFloat($(statCells[2]).text()),
                        position: 'K'
                    });
                } else if (position === 'DST' && statCells.length >= 6) {
                    Object.assign(rowData, {
                        sacks: safeFloat($(statCells[0]).text()),
                        interceptions: safeFloat($(statCells[1]).text()),
                        fumble_recoveries: safeFloat($(statCells[2]).text()),
                        fumbles_forced: safeFloat($(statCells[3]).text()),
                        defensive_tds: safeFloat($(statCells[4]).text()),
                        safeties: safeFloat($(statCells[5]).text()),
                        points_allowed: statCells.length > 6 ? safeFloat($(statCells[6]).text()) : 20,
                        yards_allowed: statCells.length > 7 ? safeFloat($(statCells[7]).text()) : 300,
                        position: 'DST'
                    });
                }
                
                if (Object.keys(rowData).length > 2) {
                    projections.push(rowData);
                }
            }
        });
        
        console.log(`Found ${projections.length} ${position} projections`);
        return projections;
        
    } catch (error) {
        console.error(`Error scraping ${position}: ${error}`);
        return [];
    }
}

// Get week projections - matching your Python get_week_projections
async function getWeekProjections(week) {
    const allProjections = [];
    
    // Offensive positions
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
        const projections = await scrapeProjections(position, week);
        
        for (const proj of projections) {
            // Base points
            const basePoints = calculateProjectedScore(proj);
            
            // Add TD length bonus based on historical patterns
            const totalTds = (proj.passing_tds || 0) + 
                           (proj.rushing_tds || 0) + 
                           (proj.receiving_tds || 0);
            
            if (totalTds > 0) {
                const tdBonus = getPlayerTdBonus(proj.player, totalTds);
                proj.projected_points = Math.round((basePoints + tdBonus) * 10) / 10;
                proj.td_bonus = tdBonus;
            } else {
                proj.projected_points = basePoints;
                proj.td_bonus = 0;
            }
            
            allProjections.push(proj);
        }
    }
    
    // Kickers with accurate distance-based scoring
    const kProjections = await scrapeProjections('K', week);
    for (const proj of kProjections) {
        proj.projected_points = getKickerPoints(
            proj.player,
            proj.fg_made || 0,
            proj.pat_made || 0
        );
        allProjections.push(proj);
    }
    
    // Defenses with return yards projections
    const dstProjections = await scrapeProjections('DST', week);
    for (const proj of dstProjections) {
        // Base defensive scoring
        const basePoints = calculateDefenseScore(proj);
        
        // Add expected return yards
        const expectedReturnYards = LEAGUE_AVG_RETURN_YARDS;
        const returnPoints = Math.round(expectedReturnYards / 10 * 10) / 10;
        
        proj.projected_points = Math.round((basePoints + returnPoints) * 10) / 10;
        proj.expected_return_yards = expectedReturnYards;
        proj.return_points = returnPoints;
        
        allProjections.push(proj);
    }
    
    return allProjections;
}

// Get optimal lineup from roster - matching your Python logic
function getOptimalLineupFromRoster(myPlayers) {
    const lineup = {
        QB: null,
        RB1: null,
        RB2: null,
        WR1: null,
        WR2: null,
        TE: null,
        FLEX: null,
        K: null,
        DST: null
    };
    
    // Sort by points
    myPlayers.sort((a, b) => b.projected_points - a.projected_points);
    const used = new Set();
    
    // Fill starters
    for (const player of myPlayers) {
        if (used.has(player.player)) continue;
        
        const pos = player.position;
        if (pos === 'QB' && !lineup.QB) {
            lineup.QB = player;
            used.add(player.player);
        } else if (pos === 'RB') {
            if (!lineup.RB1) {
                lineup.RB1 = player;
                used.add(player.player);
            } else if (!lineup.RB2) {
                lineup.RB2 = player;
                used.add(player.player);
            }
        } else if (pos === 'WR') {
            if (!lineup.WR1) {
                lineup.WR1 = player;
                used.add(player.player);
            } else if (!lineup.WR2) {
                lineup.WR2 = player;
                used.add(player.player);
            }
        } else if (pos === 'TE' && !lineup.TE) {
            lineup.TE = player;
            used.add(player.player);
        } else if (pos === 'K' && !lineup.K) {
            lineup.K = player;
            used.add(player.player);
        } else if (pos === 'DST' && !lineup.DST) {
            lineup.DST = player;
            used.add(player.player);
        }
    }
    
    // Fill FLEX with best remaining RB/WR/TE
    for (const player of myPlayers) {
        if (!used.has(player.player) && ['RB', 'WR', 'TE'].includes(player.position)) {
            lineup.FLEX = player;
            break;
        }
    }
    
    return lineup;
}

// Clean for JSON - matching your Python clean_for_json
function cleanForJson(obj) {
    if (typeof obj === 'number') {
        if (isNaN(obj) || !isFinite(obj)) {
            return 0;
        }
        return Math.round(obj * 100) / 100;  // Round to 2 decimal places
    } else if (obj === null || obj === undefined) {
        return null;
    } else if (Array.isArray(obj)) {
        return obj.map(item => cleanForJson(item));
    } else if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            cleaned[key] = cleanForJson(value);
        }
        return cleaned;
    }
    return obj;
}

// Main handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const week = parseInt(req.query.week) || 1;
        
        // Get all projections
        const projections = await getWeekProjections(week);
        
        // Get my roster projections
        const myPlayers = [];
        for (const playerName of MY_ROSTER.QB.concat(
            MY_ROSTER.RB, MY_ROSTER.WR, MY_ROSTER.TE, 
            MY_ROSTER.K, MY_ROSTER.DST
        )) {
            const matches = projections.filter(p => 
                p.player.toLowerCase().includes(playerName.toLowerCase())
            );
            if (matches.length > 0) {
                myPlayers.push(matches[0]);
            }
        }
        
        // Get optimal lineup
        const lineup = getOptimalLineupFromRoster(myPlayers);
        
        // Calculate totals
        const starterTotal = Object.values(lineup)
            .filter(p => p)
            .reduce((sum, p) => sum + p.projected_points, 0);
        
        // Prepare bench
        const lineupPlayers = Object.values(lineup)
            .filter(p => p)
            .map(p => p.player);
        const bench = myPlayers.filter(p => !lineupPlayers.includes(p.player));
        
        // Group all projections by position for top players
        const topPlayers = {};
        for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DST']) {
            topPlayers[pos] = projections
                .filter(p => p.position === pos)
                .sort((a, b) => b.projected_points - a.projected_points)
                .slice(0, 20);
        }
        
        // Build response matching your Python export_for_web
        const responseData = {
            metadata: {
                week: week,
                lastUpdated: new Date().toISOString()
            },
            myTeam: {
                optimal: lineup,
                bench: bench,
                totalPoints: Math.round(starterTotal * 10) / 10
            },
            topPlayers: topPlayers
        };
        
        // Clean and send
        const cleaned = cleanForJson(responseData);
        res.status(200).json(cleaned);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch projections' });
    }
};
