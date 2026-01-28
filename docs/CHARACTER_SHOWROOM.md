# Character Showroom Feature

## Overview

The Character Showroom is a detailed view for displaying WoW character information including equipped items, talents, stats, and more.

## Features

- **Character Header**: Name, level, race, class, gender
- **Quick Stats**: Total kills, honor points, playtime
- **Equipment Display**: All 18 equipment slots with:
  - Item icons fetched from Zamimg CDN
  - Quality-colored borders (poor, common, uncommon, rare, epic, legendary)
  - Hover tooltips showing item stats
  - Item level badges
  - **Localization support** for item names and descriptions
- **Talents**: Visual display of selected talents for both specs
- **Core Stats**: Health, mana/energy/rage display
- **Currency**: Gold and arena points

## Navigation

The character showroom can be accessed from:

1. **Account Page** (`/account/[id]`): Each character card has a "View Character" button
2. **Community Page** (`/community`): Click on any player in the Top Players leaderboard

## Technical Implementation

### Database

Item information is fetched directly from the **acore_world** database:

- **Table**: `item_template` - Contains all item statistics and properties
- **Table**: `item_template_locale` - Contains localized item names and descriptions
- **No SQLite needed** - All queries go to the MySQL world database

### Localization

The system automatically detects the client's language from the `Accept-Language` header and queries the appropriate localized fields:

- **Supported locales**: enUS, koKR, frFR, deDE, zhCN, zhTW, esES, esMX, ruRU
- **Fallback**: If no translation exists, the English (default) name is used
- **Fields localized**: Item names and descriptions

### API Endpoints

- **GET** `/api/characters/[guid]/[realmId]` - Fetch complete character details including:
  - Character basic info (level, race, class, etc.)
  - Equipped items from `character_inventory` joined with `item_template` from world DB
  - Localized item names from `item_template_locale`
  - Talents for all specs
  - Achievements
  - Statistics

### Components

1. **Character Detail Page**: `/app/pages/character/[guid]/[realmId].vue`
2. **Equipment Slot**: `/app/components/character/CharacterEquipmentSlot.vue`
   - Shows item icon, item level, quality border
   - Tooltip on hover with stats
3. **Talent Tree Display**: `/app/components/character/CharacterTalentTree.vue`
   - Interactive talent tree visualization with spell icons from Wowhead
   - Responsive design for mobile and desktop
   - Shows talent ranks, points spent per spec

### Icon Integration

Item icons are determined by the `displayid` field from `item_template` and are fetched from the Zamimg CDN. Spell/talent icons are fetched from Wowhead using the spell ID. The system uses a default icon (`inv_misc_questionmark`) when display information is not available.

## Item Stats Mapping

The equipment tooltips display various item stats:

- **Primary Stats**: Strength, Agility, Intellect, Spirit, Stamina
- **Rating Stats**: Hit Rating, Crit Rating, Haste Rating, Expertise Rating, etc.
- **Special Stats**: Armor, Damage ranges for weapons
- **Resistances**: Holy, Fire, Nature, Frost, Shadow, Arcane

Quality colors match WoW standards:

- Grey: Poor
- White: Common
- Green: Uncommon
- Blue: Rare
- Purple: Epic
- Orange: Legendary
- Yellow: Artifact
- Cyan: Heirloom

## Database Schema Reference

Refer to the official AzerothCore documentation:

- [item_template](https://www.azerothcore.org/wiki/item_template) - Main item properties
- [item_template_locale](https://www.azerothcore.org/wiki/item_template_locale) - Localized strings
- [characters database](https://www.azerothcore.org/wiki/characters) - Character data

## Future Enhancements

Potential improvements:

- Display item enchants and gems
- Show socket bonuses
- 3D character model viewer
- Talent calculator integration
- Comparison with other characters
- Achievement progress tracking
- PvP ratings and rankings
