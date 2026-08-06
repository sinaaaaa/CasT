using System.Collections;
using UnityEngine;

/// <summary>Marker action for Repeat Start / End UI blocks (does nothing when executed).</summary>
public class RepeatBoundaryAction : CharacterAction
{
    public readonly bool isStart;
    public int repeatCount;

    public RepeatBoundaryAction(bool start, int count = 1)
    {
        isStart = start;
        repeatCount = ProgramSequenceUtil.ClampRepeatCount(count);
    }

    public override IEnumerator Execute(CharacterMove characterMove)
    {
        yield break;
    }
}
