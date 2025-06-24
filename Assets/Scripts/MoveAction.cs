using System.Collections;
using UnityEngine;

namespace CharacterActions
{
    public class MoveAction : CharacterAction
    {
        public Vector3 Direction { get; private set; }

        public MoveAction(Vector3 direction)
        {
            Direction = direction;
        }

        public override IEnumerator Execute(CharacterMove characterMove)
        {
            yield return characterMove.MoveCoroutine(Direction);
        }
    }
}
