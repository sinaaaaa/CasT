using System.Collections;
using UnityEngine;

namespace CharacterActions
{
    public class RotateAction : CharacterAction
    {
        public float Angle { get; private set; }

        public RotateAction(float rotationAngle)
        {
            Angle = rotationAngle;
        }

        public override IEnumerator Execute(CharacterMove characterMove)
        {
            yield return characterMove.RotateCoroutine(Angle);
        }
    }
}
