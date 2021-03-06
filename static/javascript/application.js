window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame    ||
              window.oRequestAnimationFrame      ||
              window.msRequestAnimationFrame     ||
              function(/* function */ callback, /* DOMElement */ element){
                window.setTimeout(callback, 1000 / 60);
              };
})();

function Color(hue, saturation, lightness, alpha) {
    this.h = hue;
    this.s = saturation;
    this.l = lightness;
    this.a = alpha;
}

Color.prototype.darken = function(amount) {
    if (this.l == 0) { return; }
    this.l = Math.max(0, this.l - amount);
}

Color.prototype.lighten = function(amount) {
    if (this.l == 100) { return; }
    this.l = Math.min(100, this.l + amount);
}

Color.prototype.toString = function() {
    return "hsla(" + this.h + ", " + this.s + "%, " + this.l + "%, " + this.a + ")";
}

function AssetManager() {
    this.successCount = 0;
    this.errorCount = 0;
    this.cache = {};
    this.downloadQueue = [];
}

AssetManager.prototype.queueDownload = function(path) {
    this.downloadQueue.push(path);
}

AssetManager.prototype.downloadAll = function(callback) {
    for (var i = 0; i < this.downloadQueue.length; i++) {
        var path = this.downloadQueue[i];
        var img = new Image();
        var that = this;
        img.addEventListener("load", function() {
            that.successCount += 1;
            if (that.isDone()) {
                callback();
            }
        });
        img.addEventListener("error", function() {
            that.errorCount += 1;
            if (that.isDone()) {
                callback();
            }
        });
        img.src = path;
        this.cache[path] = img;
    }
}

AssetManager.prototype.getImage = function(path) {
    return this.cache[path];
}

AssetManager.prototype.isDone = function() {
    return (this.downloadQueue.length == this.successCount + this.errorCount);
}

var ASSET_MANAGER = new AssetManager();
ASSET_MANAGER.queueDownload("img/tower.png");
ASSET_MANAGER.queueDownload("img/explosion.png");

function Animation(spriteSheet, frameWidth, frameDuration) {
    this.spriteSheet = spriteSheet;
    this.frameWidth = frameWidth;
    this.frameDuration = frameDuration;
    this.frameHeight= this.spriteSheet.height;
    this.totalTime = (this.spriteSheet.width / this.frameWidth) * this.frameDuration;
    this.elapsedTime = 0;
    this.currentFrameIndex = 0;
}

Animation.prototype.drawFrame = function(tick, ctx, x, y) {
    this.elapsedTime += tick;
    if (this.isDone()) { return; }
    var index = Math.floor(this.elapsedTime / this.frameDuration);
    var locX = x - (this.frameWidth/2);
    var locY = y - (this.frameHeight/2);
    ctx.drawImage(this.spriteSheet, index*this.frameWidth, 0, this.frameWidth, this.frameHeight, locX, locY, this.frameWidth, this.frameHeight);
}

Animation.prototype.isDone = function() {
    return (this.elapsedTime >= this.totalTime);
}

function Planet(game, ctx) {
    this.game = game;
    this.ctx = ctx;
    this.radius = Planet.RADIUS;
    this.x = 0;
    this.y = 0;
    this.remove = false;
}

Planet.RADIUS = 50;

Planet.prototype.update = function() {

}

Planet.prototype.draw = function() {
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    this.ctx.closePath();
    this.ctx.fillStyle = "red";
    this.ctx.fill();
}

function Tower(game, ctx, x, y) {
    this.game = game;
    this.sprite = ASSET_MANAGER.getImage("img/tower.png");
    this.radius = this.sprite.width / 2;
    this.radial_distance = Math.sqrt((x*x) + (y*y)); // distance from 0,0
    this.angle = Math.atan(y / x);
    if (x < 0) {
        this.angle += Math.PI;
    }
    this.x = x;
    this.y = y;
    this.ctx = ctx;
    this.speed = 100 / this.radial_distance;
    this.remove = false;
    this.fireRange = 30;
    this.isShooting = false;
    this.rotationAngle = 0;
}

Tower.prototype.update = function() {
    this.x = this.radial_distance * Math.cos(this.angle);
    this.y = this.radial_distance * Math.sin(this.angle);
    this.angle += this.speed * this.game.clockTick;
    if (this.angle > 6.28318531) this.angle = 0;
}

Tower.prototype.draw = function() {
    /*
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    this.ctx.closePath();
    this.ctx.strokeStyle = "blue";
    this.ctx.stroke();
    this.ctx.closePath();
    */
    this.ctx.save();
    this.ctx.translate(this.x, this.y);
    this.ctx.rotate(this.rotationAngle);
    this.ctx.translate(-(this.x), -(this.y));
    this.ctx.drawImage(this.sprite, this.x - this.radius, this.y - this.radius);
    this.ctx.restore();
}

Tower.prototype.canShoot = function(alien) {
    if (this.isShooting) { return false; }
    var distance_squared = (((this.x - alien.x) * (this.x - alien.x)) + ((this.y - alien.y) * (this.y - alien.y)));
    var radii_squared = (this.radius + this.fireRange + alien.radius) * (this.radius + this.fireRange + alien.radius);
    return distance_squared < radii_squared;
}

function Alien(game, ctx, radial_distance, angle) {
    this.game = game;
    this.ctx = ctx;
    this.x = null;
    this.y = null;
    this.radius = 5;
    this.radial_distance = radial_distance;
    this.angle = angle;
    this.speed = 100;
    this.remove = false;
    this.health = 100;
    this.fillColor = new Color(111, 98, 50, 1);
    this.borderColor = new Color(111, 98, 50, 1);
}

Alien.prototype.update = function() {
    this.x = this.radial_distance * Math.cos(this.angle);
    this.y = this.radial_distance * Math.sin(this.angle);
    this.radial_distance -= this.speed * this.game.clockTick;

    if (this.hitPlanet()) {
        this.remove = true;
    }
}

Alien.prototype.hitPlanet = function() {
    var distance_squared = ((this.x * this.x) + (this.y * this.y));
    var radii_squared = (this.radius + Planet.RADIUS) * (this.radius + Planet.RADIUS);
    return distance_squared < radii_squared;
}

Alien.prototype.draw = function() {
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    this.ctx.fillStyle = this.fillColor.toString();
    this.ctx.fill();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = this.borderColor.toString();
    this.ctx.stroke();
    this.ctx.closePath();
}

Alien.prototype.hit = function(damage) {
    this.health -= damage;
    this.fillColor.darken(5);
    if (this.health <= 0 && !this.remove) {
        this.game.addEntity(new ExplodingAlien(this.game, this.ctx, this.x, this.y));
        this.remove = true;
    }
}

function ExplodingAlien(game, ctx, x, y) {
    this.game = game;
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.color = new Color(5, 97, 5, 0.8);
    this.remove = false;
    this.animation = new Animation(ASSET_MANAGER.getImage("img/explosion.png"), 24, 0.1);
}

ExplodingAlien.prototype.update = function() {
    if (this.animation.isDone()) {
        this.remove = true;
    }
}

ExplodingAlien.prototype.draw = function() {
    /*
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    this.ctx.strokeStyle = this.color.toString();
    this.ctx.stroke();
    //this.ctx.fillStyle = this.color.toString();
    //this.ctx.fill();
    this.ctx.closePath();
    */
    this.animation.drawFrame(this.game.clockTick, this.ctx, this.x, this.y);
}

function LaserBeam(game, ctx, tower, alien) {
    this.game = game;
    this.ctx = ctx;
    this.tower = tower;
    this.alien = alien;
    this.remove = false;
    this.tower.isShooting = true;
    this.damage = 100;
}

LaserBeam.prototype.update = function() {
    var xDiff = this.tower.x - this.alien.x;
    var yDiff = this.tower.y - this.alien.y;
    this.tower.rotationAngle = Math.atan2(yDiff, xDiff) - Math.PI/2;

    if (this.outOfRange(xDiff, yDiff)) {
        this.tower.isShooting = false;
        this.remove = true;
    } else {
        this.alien.hit(this.damage * this.game.clockTick);
    }
}

LaserBeam.prototype.outOfRange = function(xDiff, yDiff) {
    return (Math.sqrt((xDiff*xDiff) + (yDiff*yDiff)) > 30);
}

LaserBeam.prototype.draw = function() {
    this.ctx.beginPath();
    this.ctx.moveTo(this.tower.x, this.tower.y);
    this.ctx.lineTo(this.alien.x, this.alien.y);
    this.ctx.strokeStyle = "red";
    this.ctx.stroke();
    this.ctx.closePath();
}

function Timer() {
    this.gameTime = 0;
    this.lastTick = 0;

    this.maxStep = 0.05;
    this.lastTimestamp = 0;
}

Timer.prototype.step = function() {
    var current = Date.now();
    var delta = (current - this.lastTimestamp) / 1000;
    this.gameTime += Math.min(delta, this.maxStep);
    this.lastTimestamp = current;
}

Timer.prototype.tickDiff = function() {
    var delta = this.gameTime - this.lastTick;
    this.lastTick = this.gameTime;
    return delta;
}

function Game(ctx) {
    this.entities = [];
    this.ctx = ctx;
    this.addEntity(new Planet(game, ctx));
    this.timer = new Timer();
    this.clockTick = null;
    this.stats = new Stats();
}

Game.prototype.startInput = function() {
    var that = this;
    this.ctx.canvas.addEventListener("click", function(e) {
        var x =  event.clientX - that.ctx.canvas.getBoundingClientRect().left - (that.ctx.canvas.width/2);
        var y = event.clientY - that.ctx.canvas.getBoundingClientRect().top - (that.ctx.canvas.height/2);
        that.click = {x:x, y:y};
    });
}

Game.prototype.addEntity = function(entity) {
    this.entities.push(entity);
}

Game.prototype.start = function() {
    this.startInput();
    document.body.appendChild(this.stats.domElement);
    var that = this;
    (function gameLoop() {
        that.loop();
        requestAnimFrame(gameLoop, this.ctx.canvas);
    })();
}

Game.prototype.loop = function() {
    this.timer.step();
    this.clockTick = this.timer.tickDiff();
    this.update();
    this.draw();
    this.stats.update();
}

Game.prototype.update = function() {
    if (this.lastAlienAddedAt == null || (new Date().getTime() - this.lastAlienAddedAt) > 500) {
        this.addEntity(new Alien(this, this.ctx, this.ctx.canvas.width, Math.random() * Math.PI * 180));
        this.lastAlienAddedAt = new Date().getTime();
    }

    for (var i = 0; i < this.entities.length; i++) {
        var entity = this.entities[i];
        entity.update();

        if (entity instanceof Tower) {
            for (var x = 0; x < this.entities.length; x++) {
                var alien = this.entities[x];
                if (alien instanceof Alien) {
                    if (entity.canShoot(alien)) {
                        this.addEntity(new LaserBeam(this, this.ctx, entity, alien));
                    }
                }
            }
        }

    }

    for (var i = 0; i < this.entities.length; i++) {
        if (this.entities[i].remove == true) {
            this.entities.splice(i, 1);
        }
    }

    if (this.click != null) {
        this.addEntity(new Tower(this, this.ctx, this.click.x, this.click.y));
        this.click = null;
    }

}

Game.prototype.draw = function() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.ctx.canvas.width/2, this.ctx.canvas.height/2);
    for (var i = 0; i < this.entities.length; i++) {
        this.entities[i].draw();
    }
    this.ctx.restore();
}

var canvas = document.getElementById("game-surface");
var ctx = canvas.getContext("2d");
var game = new Game(ctx);
ASSET_MANAGER.downloadAll(function() {
    game.start();
});
