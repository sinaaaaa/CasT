using UnityEngine;
using System.Collections.Generic;

public class MultiTargetCamera : MonoBehaviour
{
    public List<Transform> targets = new List<Transform>();
    public Vector3 offset = new Vector3(0, 10, -10);
    public float minZoom = 5f;
    public float maxZoom = 20f;
    public float zoomLimiter = 50f;
    public float smoothTime = 0.2f;

    private Vector3 velocity;

    public Camera cam;

    void LateUpdate()
    {
        // Remove any destroyed or null targets
        targets.RemoveAll(t => t == null);

        if (targets.Count == 0) return;

        Move();
        Zoom();
    }

    void Move()
    {
        Vector3 centerPoint = GetCenterPoint();
        Vector3 newPosition = centerPoint + offset;
        transform.position = Vector3.SmoothDamp(transform.position, newPosition, ref velocity, smoothTime);
    }

    void Zoom()
    {
        float newZoom = Mathf.Lerp(maxZoom, minZoom, GetGreatestDistance() / zoomLimiter);
        cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, newZoom, Time.deltaTime);
    }

    float GetGreatestDistance()
    {
        var bounds = new Bounds(targets[0].position, Vector3.zero);
        foreach (var target in targets)
        {
            bounds.Encapsulate(target.position);
        }
        return Mathf.Max(bounds.size.x, bounds.size.z);
    }

    Vector3 GetCenterPoint()
    {
        if (targets.Count == 1)
            return targets[0].position;

        var bounds = new Bounds(targets[0].position, Vector3.zero);
        foreach (var target in targets)
        {
            bounds.Encapsulate(target.position);
        }
        return bounds.center;
    }
}
