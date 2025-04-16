export class otherCtx {
    ctx: CanvasRenderingContext2D;
    cameraX: number = 0;
    cameraY: number = 0;
    targetCameraX: number = 0;
    targetCameraY: number = 0;
    zoom: number = 1;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    setCamera(x: number, y: number) {
        this.targetCameraX = x;
        this.targetCameraY = y;
    }

    updateCamera(deltaTime: number) {
        const lerpFactor = 5; // Adjust for smoother or faster panning
        this.cameraX += (this.targetCameraX - this.cameraX) * lerpFactor * deltaTime;
        this.cameraY += (this.targetCameraY - this.cameraY) * lerpFactor * deltaTime;
    }

    setZoom(zoom: number) {
        this.zoom = zoom;
    }

    drawRect(x: number, y: number, width: number, height: number, color: string) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            (x - this.cameraX) * this.zoom,
            (y - this.cameraY) * this.zoom,
            width * this.zoom,
            height * this.zoom
        );
    }

    drawCircle(x: number, y: number, radius: number, color: string) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(
            (x - this.cameraX) * this.zoom,
            (y - this.cameraY) * this.zoom,
            radius * this.zoom,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
    }

    drawText(x: number, y: number, text: string, color: string, fontSize: number) {
        this.ctx.fillStyle = color;
        this.ctx.font = `${fontSize * this.zoom}px Arial`;
        this.ctx.fillText(
            text,
            (x - this.cameraX) * this.zoom,
            (y - this.cameraY) * this.zoom
        );
    }

    drawImage(image: HTMLImageElement, x: number, y: number, width: number, height: number) {
        this.ctx.drawImage(
            image,
            (x - this.cameraX) * this.zoom,
            (y - this.cameraY) * this.zoom,
            width * this.zoom,
            height * this.zoom
        );
    }

    rawCtx() {
        return this.ctx;
    }

    setCtx(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    clearBackground(color: string) {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    drawLine(x1: number, y1: number, x2: number, y2: number, color: string) {
        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(
            (x1 - this.cameraX) * this.zoom,
            (y1 - this.cameraY) * this.zoom
        );
        this.ctx.lineTo(
            (x2 - this.cameraX) * this.zoom,
            (y2 - this.cameraY) * this.zoom
        );
        this.ctx.stroke();
    }

    drawPolygon(points: Array<{ x: number, y: number }>, color: string) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(
            (points[0].x - this.cameraX) * this.zoom,
            (points[0].y - this.cameraY) * this.zoom
        );
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(
                (points[i].x - this.cameraX) * this.zoom,
                (points[i].y - this.cameraY) * this.zoom
            );
        }
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawImageScaled(image: HTMLImageElement, x: number, y: number, width: number, height: number) {
        this.ctx.drawImage(
            image,
            (x - this.cameraX) * this.zoom,
            (y - this.cameraY) * this.zoom,
            width * this.zoom,
            height * this.zoom
        );
    }

    drawTriangles(vertices: Vertex[], indices: number[], color: string) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();

        for (let i = 0; i < indices.length; i += 3) {
            const v1 = vertices[indices[i]];
            const v2 = vertices[indices[i + 1]];
            const v3 = vertices[indices[i + 2]];

            this.ctx.moveTo(
                (v1.dstX - this.cameraX) * this.zoom,
                (v1.dstY - this.cameraY) * this.zoom
            );
            this.ctx.lineTo(
                (v2.dstX - this.cameraX) * this.zoom,
                (v2.dstY - this.cameraY) * this.zoom
            );
            this.ctx.lineTo(
                (v3.dstX - this.cameraX) * this.zoom,
                (v3.dstY - this.cameraY) * this.zoom
            );
        }

        this.ctx.closePath();
        this.ctx.fill();
    }

    drawImageRotated(image: HTMLImageElement, x: number, y: number, width: number, height: number, angle: number) {
        this.ctx.save();
        this.ctx.translate(
            (x - this.cameraX) * this.zoom + (width * this.zoom) / 2,
            (y - this.cameraY) * this.zoom + (height * this.zoom) / 2
        );
        this.ctx.rotate(angle);
        this.ctx.drawImage(
            image,
            -(width * this.zoom) / 2,
            -(height * this.zoom) / 2,
            width * this.zoom,
            height * this.zoom
        );
        this.ctx.restore();
    }

    drawImageWithAlpha(image: HTMLImageElement, x: number, y: number, width: number, height: number, alpha: number) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.drawImage(
            image,
            (x - this.cameraX) * this.zoom,
            (y - this.cameraY) * this.zoom,
            width * this.zoom,
            height * this.zoom
        );
        this.ctx.restore();
    }

    drawImageWithScale(image: HTMLImageElement, x: number, y: number, scaleX: number, scaleY: number) {
        this.ctx.drawImage(
            image,
            (x - this.cameraX) * this.zoom,
            (y - this.cameraY) * this.zoom,
            image.width * scaleX * this.zoom,
            image.height * scaleY * this.zoom
        );
    }

    drawImageWithRotation(image: HTMLImageElement, x: number, y: number, width: number, height: number, angle: number) {
        this.ctx.save();
        this.ctx.translate(
            (x - this.cameraX) * this.zoom + (width * this.zoom) / 2,
            (y - this.cameraY) * this.zoom + (height * this.zoom) / 2
        );
        this.ctx.rotate(angle);
        this.ctx.drawImage(
            image,
            -(width * this.zoom) / 2,
            -(height * this.zoom) / 2,
            width * this.zoom,
            height * this.zoom
        );
        this.ctx.restore();
    }
}

export class Scene {
    update(deltaTime: number, commands: Commands) {
        // Override this method in scenes
    }

    draw(ctx: otherCtx) {
        // Override this method in scenes
    }
}

export class OCtxButton {
    bounds: { x: number, y: number, width: number, height: number };
    label: string;
    backgroundColor: string = '#D3D3D3';  // LightGray
    hoverColor: string = '#C8C8C8';      // RGB(200,200,200)
    pressedColor: string = '#A9A9A9';    // DarkGray
    borderColor: string = '#000000';      // Black
    textColor: string = '#000000';        // Black
    fontSize: number = 20;
    isHovered: boolean = false;
    isPressed: boolean = false;
    private animationProgress: number = 0.0;
    padding: number = 5.0;
    cornerRadius: number = 5.0;
    enabled: boolean = true;
    invisible: boolean = false;
    uneditable: boolean = false;
    useRoundedCorners: boolean = true;

    constructor(x: number, y: number, width: number, height: number, label: string) {
        this.bounds = { x, y, width, height };
        this.label = label;
    }

    setColors(background: string, hover: string, pressed: string, border: string, text: string) {
        this.backgroundColor = background;
        this.hoverColor = hover;
        this.pressedColor = pressed;
        this.borderColor = border;
        this.textColor = text;
    }

    update(commands: Commands) {
        if (this.uneditable) return;
        if (!this.enabled) {
            this.isHovered = false;
            this.isPressed = false;
            return;
        }

        const mouseX = commands.mouseX;
        const mouseY = commands.mouseY;
        this.isHovered = this.pointInRect(mouseX, mouseY);
        this.isPressed = this.isHovered && commands.mouseDown;

        let targetProgress = 0.0;
        if (this.isPressed) targetProgress = 1.0;
        else if (this.isHovered) targetProgress = 0.5;

        const animationSpeed = 8.0;
        const frameTime = 1/60; // Approximate frame time
        if (this.animationProgress < targetProgress) {
            this.animationProgress += frameTime * animationSpeed;
            if (this.animationProgress > targetProgress) this.animationProgress = targetProgress;
        } else if (this.animationProgress > targetProgress) {
            this.animationProgress -= frameTime * animationSpeed;
            if (this.animationProgress < targetProgress) this.animationProgress = targetProgress;
        }
    }

    draw(ctx: otherCtx) {
        if (this.invisible) return;

        let currentColor = this.backgroundColor;
        if (!this.enabled) {
            currentColor = this.adjustAlpha(this.backgroundColor, 0.5);
        } else {
            if (this.animationProgress <= 0.5) {
                const t = this.animationProgress * 2.0;
                currentColor = this.lerpColor(this.backgroundColor, this.hoverColor, t);
            } else {
                const t = (this.animationProgress - 0.5) * 2.0;
                currentColor = this.lerpColor(this.hoverColor, this.pressedColor, t);
            }
        }

        const borderThickness = this.isPressed ? 3 : 2;
        const offsetX = this.isPressed ? 1 : 0;
        const offsetY = this.isPressed ? 1 : 0;

        if (this.useRoundedCorners) {
            // Draw rounded rectangle background
            this.drawRoundedRect(ctx, this.bounds.x, this.bounds.y, 
                this.bounds.width, this.bounds.height, this.cornerRadius, currentColor);
            // Draw border
            this.drawRoundedRectBorder(ctx, this.bounds.x, this.bounds.y,
                this.bounds.width, this.bounds.height, this.cornerRadius, 
                this.borderColor, borderThickness);
        } else {
            ctx.drawRect(this.bounds.x, this.bounds.y, 
                this.bounds.width, this.bounds.height, currentColor);
            // Draw border
            this.drawRectBorder(ctx, this.bounds.x, this.bounds.y,
                this.bounds.width, this.bounds.height, this.borderColor, borderThickness);
        }

        // Draw text
        const textColor = this.enabled ? this.textColor : this.adjustAlpha(this.textColor, 0.5);
        ctx.drawText(
            this.bounds.x + this.bounds.width / 2 + offsetX,
            this.bounds.y + this.bounds.height / 2 + offsetY,
            this.label,
            textColor,
            this.fontSize
        );
    }

    isClicked(commands: Commands): boolean {
        return this.enabled && this.isHovered && commands.mouseReleased;
    }

    private pointInRect(x: number, y: number): boolean {
        return x >= this.bounds.x && x <= this.bounds.x + this.bounds.width &&
               y >= this.bounds.y && y <= this.bounds.y + this.bounds.height;
    }

    private drawRoundedRect(ctx: otherCtx, x: number, y: number, w: number, h: number, r: number, color: string) {
        const points = this.getRoundedRectPoints(x, y, w, h, r);
        ctx.drawPolygon(points, color);
    }

    private drawRoundedRectBorder(ctx: otherCtx, x: number, y: number, w: number, h: number, r: number, color: string, thickness: number) {
        const points = this.getRoundedRectPoints(x, y, w, h, r);
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            ctx.drawLine(p1.x, p1.y, p2.x, p2.y, color);
        }
    }

    private drawRectBorder(ctx: otherCtx, x: number, y: number, w: number, h: number, color: string, thickness: number) {
        for (let i = 0; i < thickness; i++) {
            ctx.drawLine(x+i, y+i, x+w-i, y+i, color);
            ctx.drawLine(x+w-i, y+i, x+w-i, y+h-i, color);
            ctx.drawLine(x+w-i, y+h-i, x+i, y+h-i, color);
            ctx.drawLine(x+i, y+h-i, x+i, y+i, color);
        }
    }

    private getRoundedRectPoints(x: number, y: number, w: number, h: number, r: number): Array<{x: number, y: number}> {
        const points: Array<{x: number, y: number}> = [];
        const steps = 8;
        
        // Top-left corner
        for (let i = 0; i <= steps; i++) {
            const angle = Math.PI * 1.5 + (Math.PI / 2) * (i / steps);
            points.push({
                x: x + r + r * Math.cos(angle),
                y: y + r + r * Math.sin(angle)
            });
        }
        
        // Add remaining corners
        points.push({x: x + w - r, y: y});
        points.push({x: x + w, y: y + r});
        points.push({x: x + w, y: y + h - r});
        points.push({x: x + w - r, y: y + h});
        points.push({x: x + r, y: y + h});
        points.push({x: x, y: y + h - r});
        points.push({x: x, y: y + r});
        
        return points;
    }

    private lerpColor(color1: string, color2: string, t: number): string {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        
        return `rgb(${
            Math.round(c1.r + (c2.r - c1.r) * t)},${
            Math.round(c1.g + (c2.g - c1.g) * t)},${
            Math.round(c1.b + (c2.b - c1.b) * t)})`;
    }

    private hexToRgb(hex: string): {r: number, g: number, b: number} {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : {r: 0, g: 0, b: 0};
    }

    private adjustAlpha(color: string, alpha: number): string {
        const rgb = this.hexToRgb(color);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
}

export class OCtxTextField {
    bounds: { x: number, y: number, width: number, height: number };
    text: string = "";
    maxLength: number;
    backgroundColor: string = "#FFFFFF";  // White
    borderColor: string = "#000000";      // Black
    textColor: string = "#000000";        // Black
    placeholderColor: string = "#808080"; // Gray
    placeholder: string = "";
    fontSize: number = 20;
    isActive: boolean = false;
    cursorPosition: number = 0;
    private cursorBlinkTimer: number = 0;
    private backspaceHoldTimer: number = 0;
    invisible: boolean = false;
    uneditable: boolean = false;
    paddingLeft: number = 5;

    constructor(x: number, y: number, width: number, height: number, maxLength: number) {
        this.bounds = { x, y, width, height };
        this.maxLength = maxLength;
    }

    setColors(background: string, border: string, text: string) {
        this.backgroundColor = background;
        this.borderColor = border;
        this.textColor = text;
    }

    setPlaceholder(text: string) {
        this.placeholder = text;
    }

    getPlaceholder(): string {
        return this.placeholder;
    }

    setPlaceholderColor(color: string) {
        this.placeholderColor = color;
    }

    setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    setInvisible(invisible: boolean) {
        this.invisible = invisible;
    }

    isInvisible(): boolean {
        return this.invisible;
    }

    setUneditable(uneditable: boolean) {
        this.uneditable = uneditable;
    }

    isUneditable(): boolean {
        return this.uneditable;
    }

    update(commands: Commands, deltaTime: number) {
        if (this.uneditable) return;

        this.cursorBlinkTimer += deltaTime;
        if (this.cursorBlinkTimer >= 1.0) {
            this.cursorBlinkTimer = 0.0;
        }

        if (commands.mouseReleased) {
            this.isActive = this.pointInRect(commands.mouseX, commands.mouseY);
        }

        if (this.isActive) {
            // Handle character input
            for (const key in commands.keys) {
                if (commands.keys[key] && key.length === 1) {
                    if (this.text.length < this.maxLength) {
                        this.text = this.text.slice(0, this.cursorPosition) + key + this.text.slice(this.cursorPosition);
                        this.cursorPosition++;
                    }
                    commands.keys[key] = false; // Consume the key
                }
            }

            // Handle special keys
            if (commands.keys["Backspace"]) {
                this.backspaceHoldTimer += deltaTime;
                if (commands.keys["Backspace"] && (this.backspaceHoldTimer === deltaTime || this.backspaceHoldTimer > 0.5)) {
                    if (this.cursorPosition > 0) {
                        this.text = this.text.slice(0, this.cursorPosition - 1) + this.text.slice(this.cursorPosition);
                        this.cursorPosition--;
                    }
                }
            } else {
                this.backspaceHoldTimer = 0;
            }

            if (commands.keys["ArrowLeft"]) {
                if (this.cursorPosition > 0) {
                    this.cursorPosition--;
                }
                commands.keys["ArrowLeft"] = false;
            }

            if (commands.keys["ArrowRight"]) {
                if (this.cursorPosition < this.text.length) {
                    this.cursorPosition++;
                }
                commands.keys["ArrowRight"] = false;
            }

            if (commands.keys["Home"]) {
                this.cursorPosition = 0;
                commands.keys["Home"] = false;
            }

            if (commands.keys["End"]) {
                this.cursorPosition = this.text.length;
                commands.keys["End"] = false;
            }
        }
    }

    draw(ctx: otherCtx) {
        if (this.invisible) return;

        // Draw background
        ctx.drawRect(
            this.bounds.x,
            this.bounds.y,
            this.bounds.width,
            this.bounds.height,
            this.backgroundColor
        );

        // Draw border
        const borderColor = this.isActive ? "#FF0000" : this.borderColor;
        const thickness = 2;
        for (let i = 0; i < thickness; i++) {
            ctx.drawLine(
                this.bounds.x + i,
                this.bounds.y + i,
                this.bounds.x + this.bounds.width - i,
                this.bounds.y + i,
                borderColor
            );
            ctx.drawLine(
                this.bounds.x + this.bounds.width - i,
                this.bounds.y + i,
                this.bounds.x + this.bounds.width - i,
                this.bounds.y + this.bounds.height - i,
                borderColor
            );
            ctx.drawLine(
                this.bounds.x + this.bounds.width - i,
                this.bounds.y + this.bounds.height - i,
                this.bounds.x + i,
                this.bounds.y + this.bounds.height - i,
                borderColor
            );
            ctx.drawLine(
                this.bounds.x + i,
                this.bounds.y + this.bounds.height - i,
                this.bounds.x + i,
                this.bounds.y + i,
                borderColor
            );
        }

        // Draw text or placeholder with corrected vertical position
        const textY = this.bounds.y + (this.bounds.height + this.fontSize) / 2;

        if (this.text.length > 0) {
            ctx.drawText(
                this.bounds.x + this.paddingLeft,
                textY,
                this.text,
                this.textColor,
                this.fontSize
            );
        } else if (this.placeholder) {
            ctx.drawText(
                this.bounds.x + this.paddingLeft,
                textY,
                this.placeholder,
                this.placeholderColor,
                this.fontSize
            );
        }

        // Draw cursor with matching alignment
        if (this.isActive && this.cursorBlinkTimer < 0.5) {
            const textWidth = ctx.rawCtx().measureText(this.text.slice(0, this.cursorPosition)).width;
            ctx.drawLine(
                this.bounds.x + this.paddingLeft + textWidth,
                this.bounds.y + (this.bounds.height - this.fontSize) / 2,
                this.bounds.x + this.paddingLeft + textWidth,
                this.bounds.y + (this.bounds.height + this.fontSize) / 2,
                this.textColor
            );
        }
    }

    getText(): string {
        return this.text;
    }

    setValue(value: string) {
        this.text = value.slice(0, Math.min(value.length, this.maxLength));
        this.cursorPosition = this.text.length;
    }

    activate() {
        this.isActive = true;
        this.cursorPosition = this.text.length;
    }

    deactivate() {
        this.isActive = false;
        this.cursorPosition = 0;
    }

    private pointInRect(x: number, y: number): boolean {
        return x >= this.bounds.x && x <= this.bounds.x + this.bounds.width &&
               y >= this.bounds.y && y <= this.bounds.y + this.bounds.height;
    }
}

export class Vertex {
    dstX: number;
    dstY: number;
    srcX: number;
    srcY: number;
    colorR: number;
    colorG: number;
    colorB: number;
    colorA: number;

    constructor(
        dstX: number,
        dstY: number,
        srcX: number,
        srcY: number,
        colorR: number,
        colorG: number,
        colorB: number,
        colorA: number
    ) {
        this.dstX = dstX;
        this.dstY = dstY;
        this.srcX = srcX;
        this.srcY = srcY;
        this.colorR = colorR;
        this.colorG = colorG;
        this.colorB = colorB;
        this.colorA = colorA;
    }
}

export class Commands {
    scenes: Scene[];
    currentSceneIndex: number;
    keys: { [key: string]: boolean } = {};
    mouseX: number = 0;
    mouseY: number = 0;
    mouseDown: boolean = false;
    mouseReleased: boolean = false;

    constructor(scenes: Scene[], initialSceneIndex: number = 0) {
        this.scenes = scenes;
        this.currentSceneIndex = initialSceneIndex;

        document.addEventListener('keydown', (event) => {
            if (!this.keys[event.key]) {
                this.keys[event.key] = true;
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.key] = false;
        });
    }

    bindMouseEvents(canvas: HTMLCanvasElement) {
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        canvas.addEventListener('mousedown', () => {
            this.mouseDown = true;
            this.mouseReleased = false;
        });

        canvas.addEventListener('mouseup', () => {
            this.mouseReleased = true;
            this.mouseDown = false;

            setTimeout(() => {
                this.mouseReleased = false;
            }, 50);
        });
    }

    switchScene(index: number) {
        if (index >= 0 && index < this.scenes.length) {
            this.currentSceneIndex = index;
        } else {
            console.error(`Invalid scene index: ${index}`);
        }
    }

    getCurrentSceneIndex() {
        return this.currentSceneIndex;
    }
}

export function ctxengnloop(scenes: Scene[], commands: Commands, ctx: CanvasRenderingContext2D, lastTime: number, other: otherCtx) {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;

    other.updateCamera(deltaTime); // Smoothly update the camera position

    const currentScene = scenes[commands.getCurrentSceneIndex()];
    currentScene.update(deltaTime, commands); // Pass the Commands instance
    currentScene.draw(other); // Pass the otherCtx instance
    requestAnimationFrame(() => ctxengnloop(scenes, commands, ctx, currentTime, other));
}

export function contextEngine(scenes: Scene[], initialSceneIndex: number = 0, canvasWidth: number = 800, canvasHeight: number = 600) {
    // some checkers
    if (!scenes || scenes.length === 0) {
        throw new Error('No scenes provided');
    }

    if (initialSceneIndex < 0 || initialSceneIndex >= scenes.length) {
        throw new Error('Invalid initial scene index');
    }

    if (typeof canvasWidth !== 'number' || typeof canvasHeight !== 'number') {
        throw new Error('Canvas width and height must be numbers');
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    const other = new otherCtx(ctx);
    const commands = new Commands(scenes, initialSceneIndex);
    commands.bindMouseEvents(canvas);
    other.setCamera(0, 0);

    const startTime = performance.now();
    ctxengnloop(scenes, commands, ctx, startTime, other);
}