using System.Collections.Generic;

/// <summary>
/// Default intro sequences — copy and edit in <see cref="CharacterMove.InitializeLevelData"/>
/// or assign sprites on <see cref="LevelCornerHint.image"/> in the Inspector.
/// </summary>
public static class ActionBlockIntroDefaults
{
    public static ActionBlockIntroConfig Level0FourMoves()
    {
        return new ActionBlockIntroConfig
        {
            enabled = true,
            introId = "level_0_action_blocks",
            showOnlyOnce = true,
            completeMessage = "Great! You're ready for Item 1.",
            steps = new List<ActionBlockIntroStepData>
            {
                Step("forward",
                    "Forward",
                    "Moves Robo one step in the direction he is facing.",
                    "Drag Forward to the yellow strip."),
                Step("backward",
                    "Backward",
                    "Moves Robo one step backward.",
                    "Drag Backward to the yellow strip."),
                Step("turn right",
                    "Turn Right",
                    "Rotates Robo to face his right side.",
                    "Drag Turn Right to the yellow strip."),
                Step("turn left",
                    "Turn Left",
                    "Rotates Robo to face his left side.",
                    "Drag Turn Left to the yellow strip."),
            }
        };
    }

    private static ActionBlockIntroStepData Step(string action, string title, string body, string drag)
    {
        return new ActionBlockIntroStepData
        {
            action = action,
            dragInstruction = drag,
            runInstruction = "Now tap Run!",
            runningInstruction = "Watch Robo go!",
            stepHint = new LevelCornerHint
            {
                enabled = true,
                title = title,
                body = body
            }
        };
    }
}
