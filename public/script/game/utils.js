// SPDX-License-Identifier: MIT

export function isMobileDevice() {
    //return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    return false;
}

export function checkCollision(objA, objB) {
    if (!objB.rotation) {
        return objA.x < objB.x + objB.width &&
               objA.x + objA.width > objB.x &&
               objA.y < objB.y + objB.height &&
               objA.y + objA.height > objB.y;
    }

    const centerAX = objA.x + objA.width / 2;
    const centerAY = objA.y + objA.height / 2;
    const centerBX = objB.x + objB.width / 2;
    const centerBY = objB.y + objB.height / 2;
    const dx = centerAX - centerBX;
    const dy = centerAY - centerBY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radiusA = Math.max(objA.width, objA.height) / 2;
    const radiusB = Math.max(objB.width, objB.height) / 2;

    return distance < (radiusA + radiusB);
}

export function Task(fn) {
    (async () => {
        await fn();
    });
}

export function lerp(start, end, t) {
    return start + (end - start) * t;
}
