using System.Collections;
using UnityEngine;
using System.Collections.Generic;
using System;

public abstract class CharacterAction
{
    public abstract IEnumerator Execute(CharacterMove characterMove);

    // Add this for Level1 support
    public virtual IEnumerator Execute(Level1 level1)
    {
        throw new NotImplementedException();
    }
}



