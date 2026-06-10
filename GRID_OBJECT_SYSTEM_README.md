# Grid Object System - Start to End Object Navigation

This system allows the robot to navigate from a start object to an end object in each level, with different object types and attempt limits.

## Features

- **Start/End Objects**: Each level has a start object and an end object
- **Multiple Object Types**: banana, bin, newspaper, recycle, apple, box
- **Attempt Limits**: Each level has a maximum number of attempts
- **Fade Effects**: Objects fade out when reached
- **No Success Popup**: Levels complete automatically when end object is reached
- **Retry System**: Failed attempts show retry popup with attempt counter

## Setup Instructions

### 1. Create Grid Object Prefabs

Create prefabs for each object type:
- `bananaPrefab`
- `binPrefab` 
- `newspaperPrefab`
- `recyclePrefab`
- `applePrefab`
- `boxPrefab`

### 2. Assign Prefabs to CharacterMove

In the CharacterMove component inspector, assign the prefabs to the new fields:
- Banana Prefab
- Bin Prefab
- Newspaper Prefab
- Recycle Prefab
- Apple Prefab
- Box Prefab

### 3. Configure Levels

Each level in `InitializeLevelData()` now includes:
```csharp
new LevelData 
{
    levelName = "Level 1",
    maxAttempts = 2, // Maximum attempts for this level
    robotStartPosition = new Vector2Int(1,-3),
    robotStartFacing = Vector2Int.up,
    gridObjects = new List<GridObjectData>
    {
        new GridObjectData { position = new Vector2Int(0,0), objectType = "newspaper", isStartObject = true },
        new GridObjectData { position = new Vector2Int(1,-1), objectType = "banana", isEndObject = true }
    }
}
```

### 4. Using GridObjectSetup Helper

Add the `GridObjectSetup` script to a GameObject in your scene:

1. **Assign Prefabs**: Drag your object prefabs to the script fields
2. **Validate**: Use "Validate Prefabs" context menu to check assignments
3. **Test**: Use "Test Object Placement" to verify prefabs work
4. **Create Sample**: Use "Create Sample Level" to generate example levels

## How It Works

### Level Flow
1. **Start**: Robot begins at `robotStartPosition`
2. **Find Start Object**: Robot must reach the start object first
3. **Start Object Fades**: When reached, start object fades out
4. **Find End Object**: Robot must then reach the end object
5. **Level Complete**: End object fades out, level advances automatically

### Attempt System
- Each level has a `maxAttempts` limit
- Failed attempts show retry popup with attempt counter
- "Try Again" button resets the level without changing scene
- When max attempts reached, shows final retry message

### Object Types
- **banana**: Yellow banana object
- **bin**: Trash bin object  
- **newspaper**: Newspaper object
- **recycle**: Recycling bin object
- **apple**: Apple object
- **box**: Box/cardboard object

## Level Configuration Examples

### Simple Level (Level 1)
```csharp
maxAttempts = 2
Start: newspaper at (0,0)
End: banana at (1,-1)
```

### Complex Level (Level 3)
```csharp
maxAttempts = 4
Start: bin at (0,2)
End: apple at (2,1)
Guided actions with blanks
```

## Troubleshooting

### Objects Not Appearing
- Check that prefabs are assigned in CharacterMove inspector
- Verify prefabs have Renderer components for fade effects
- Ensure grid positions are within valid range

### Fade Effects Not Working
- Objects must have Renderer components
- Materials should support transparency
- Check that objects are active in hierarchy

### Level Not Advancing
- Verify end object is marked with `isEndObject = true`
- Check that robot reaches both start and end objects
- Ensure `hasReachedStartObject` and `hasReachedEndObject` are set

### Attempt Counter Issues
- Verify `maxAttempts` is set for each level
- Check that `currentAttempt` is being incremented
- Ensure retry popup is properly configured

## Customization

### Adding New Object Types
1. Create new prefab
2. Add to `GetGridObjectPrefab()` method
3. Add prefab field to CharacterMove
4. Update GridObjectSetup script

### Modifying Fade Effects
Edit the `FadeOutObject()` method to change:
- Fade duration (`fadeTime`)
- Fade curve (currently linear)
- Additional effects (particles, sounds, etc.)

### Changing Attempt Logic
Modify the attempt checking in `ProcessActions()` to:
- Change when attempts are counted
- Modify retry behavior
- Add different failure conditions
