'use strict';
const config = require('../config.js'); //configuration data

const Bombable = require('../objects/bombable.js'); //father
const Point = require('../general/point.js');
const Identifiable = require('../id/identifiable.js'); //deploy power ups

//default enemy values
const enemySpritePath = config.keys.enemy;
const enemyExtraOffset = config.enemyExtraOffset;

const enemyImmovable = config.enemyImmovable;
const enemyInvecibleTime = config.enemyInvecibleTime; //maybe reduce
const bombFlameTimer = config.bombFlameTimer; //to sync with flames
const tmpInvenTime = config.tmpInvenTime; //to sync with flames

//all the data (points, speed, sprite, bodysize)
var enemyDataBase = require('./enemyDataBase.js');

//Enemy constructor. Inherits from Bombable.
//The players detects overlap with these, and dies.
function Enemy(game, position, level, enemyType, tileData, groups, dropId) {

    this.tileData = tileData;
    this.groups = groups;
    this.level = level;

    this.enemyType = enemyType; //not really used atm
    this.pts = enemyDataBase[enemyType].pts;

    var enemyBodySize = enemyDataBase[enemyType].bodySize;
    var enemyBodyOffset = enemyDataBase[enemyType].bodyOffset;

    var enemySprite = enemySpritePath + "_" + enemyType; //constructed
    var enemyPosition = position.add(enemyExtraOffset.x, enemyExtraOffset.y);

    Bombable.call(this, game, level, groups, enemyPosition, enemySprite,
        tileData.Scale, enemyBodySize, enemyBodyOffset, enemyImmovable,
        enemyDataBase[enemyType].lives, enemyInvecibleTime, dropId);

    //Enemy animations
    this.animations.add("walking_left", [19, 20, 21, 22, 23, 24, 25], 10, true);
    this.animations.add("walking_right", [12, 13, 14, 15, 16, 17, 18], 10, true);
    this.animations.add("walking_up", [0, 1, 2, 3, 4, 5], 10, true);
    this.animations.add("walking_down", [6, 7, 8, 9, 10, 11], 10, true);

    level.updateSquare(position, level.types.free.value); //clears the map square

    //starting the movement
    this.dir = new Point();
    this.velocity = enemyDataBase[enemyType].velocity;
    this.pickDirection();
    this.setSpeed(this.dir);
};

Enemy.prototype = Object.create(Bombable.prototype);
Enemy.prototype.constructor = Enemy;

Enemy.prototype.update = function () {

    this.checkFlames(); //bombable method

    if (this.dead) { //not moving
        this.body.immovable = true;
        this.body.velocity.x = 0;
        this.body.velocity.y = 0;
    }
    else {
        //if hitted (and not dead) its alpha waves
        if (this.tmpInven) this.invencibleAlpha();

        this.logicMovement(); //basic IA

        //animation
        if (this.body.velocity.x > 0) {
            // this.scale.setTo(this.tileData.Scale.x, this.tileData.Scale.y);
            this.animations.play("walking_right");
        }
        else if (this.body.velocity.x < 0) {
            // this.scale.setTo(this.tileData.Scale.x*-1, this.tileData.Scale.y);
            this.animations.play("walking_left");
        }
        else if (this.body.velocity.y > 0)
            this.animations.play("walking_down");
        else if (this.body.velocity.y < 0)
            this.animations.play("walking_up");
        else {
            //pick direction if trapped to be able to scape afterwards
            this.pickDirection();
            if (this.dir.x !== 0 || this.dir.y !== 0) this.setSpeed(this.dir);
            this.animations.stop();
        }
    }
}


//player, bomb, enemie, etc extend this (from bombable)
Enemy.prototype.die = function (flame) {
    // console.log("checkin enemie die");
    this.lives--;

    if (this.lives <= 0) {
        this.dead = true;
        this.alpha /= 2; //half alpha when killed

        //if it has a power up, drops it
        if (this.dropId !== undefined)
            this.game.time.events.add(bombFlameTimer - 5, drop, this);

        //gives points to the player
        if (flame.player !== undefined) flame.player.addPoints(this.pts);

        //then destroys itself
        this.game.time.events.add(bombFlameTimer + 5, this.destroy, this);
    }
    //if not killed then becomes vencible again
    else this.game.time.events.add(enemyInvecibleTime, flipInven, this);

    function flipInven() { this.tmpInven = false; this.alpha = 1; }
    function drop() {
        this.groups.powerUp.add(
            new Identifiable(this.game, this.position, this.scale, this.dropId));
    }
}


//all the IA is just movement
Enemy.prototype.logicMovement = function () {

    //virtual map pos and extra pos to cehck collisions
    var positionMap = new Point(this.position.x, this.position.y)
        .getMapSquarePos(this.tileData, enemyExtraOffset);
    var extraPosMap = new Point(this.position.x, this.position.y)
        .getMapSquareExtraPos(this.tileData, enemyExtraOffset);

    //first we check if the path is blocked
    if (this.checkCollision(positionMap, extraPosMap)) {

        this.body.velocity.x = 0; //stops the enemy
        this.body.velocity.y = 0;

        this.pickDirection(); //change direction

        //moves the enemy (if it is not totally blocked) **may change this
        if (this.dir.x !== 0 || this.dir.y !== 0)
            this.setSpeed(this.dir);
    }
    //and then we check if some enemy is on the path
    else if (this.checkEnemyOverlap(positionMap)) {
        this.body.velocity.x *= -1; //inverts its velocity
        this.body.velocity.y *= -1;
        this.dir.multiply(-1, -1); //and dir accordingly too
    }
}

//Picks a new rnd direction (free)
Enemy.prototype.pickDirection = function () {

    var positionMap = new Point(this.position.x, this.position.y)
        .getMapSquarePos(this.tileData, enemyExtraOffset);

    //array with all free dirs
    var freeSurroungings = this.level.getSurroundingFreeSquares(positionMap);

    var rnd = this.game.rnd.integerInRange(0, freeSurroungings.length - 1);

    // console.log(positionMap, freeSurroungings, rnd);

    //picks a dir using rnd
    if (freeSurroungings.length === 0) this.dir = new Point();
    else this.dir = freeSurroungings[rnd];
}

//Simple method to set speed
Enemy.prototype.setSpeed = function (dir) {
    if (this.dir.x === 1) this.body.velocity.x = this.velocity;
    else if (this.dir.x === -1) this.body.velocity.x = -this.velocity;
    else if (this.dir.y === 1) this.body.velocity.y = this.velocity;
    else if (this.dir.y === -1) this.body.velocity.y = -this.velocity;
}

//checks if the enemy is getting closer to a block
Enemy.prototype.checkCollision = function (positionMap, extraPosMap) {
    var blocked = false;

    //checks if the next square is free and if the enemy is in the center
    if ((!this.level.isNextSquareFree(positionMap, this.dir))
        && extraPosMap.isNull()) {
        // console.log("Enemy turning");
        blocked = true;
    }

    return blocked;
}

//checks for enemies blocking the path
Enemy.prototype.checkEnemyOverlap = function (positionMap) {

    var enemyBlocking = false;
    this.game.physics.arcade.overlap(this, this.groups.enemy, checkPositions);

    return enemyBlocking; //the callback affects the bool...

    //only matters if the other enemy is blocking the path
    //(we do nothing if thisEnemy is the one blocking otherEnemy)
    function checkPositions(thisEnemy, otherEnemy) {

        if (thisEnemy !== otherEnemy) { //not overlap with itself
            //console.log("Enemy overlapping");

            var otherEnemyPos = new Point(otherEnemy.position.x, otherEnemy.position.y)
                .getMapSquarePos(otherEnemy.tileData, enemyExtraOffset);

            //first calculates the next position
            var nextPos = new Point(positionMap.x, positionMap.y)
                .add(thisEnemy.dir.x, thisEnemy.dir.y)

            //gets the array to check
            var positionsToCheck = getPositionsToCheck(nextPos, thisEnemy);
            // console.log(positionsToCheck);

            //if any of the pos are occupied then thepath is blocked
            for (var i = 0; i < positionsToCheck.length; i++) {

                if (positionsToCheck[i].isEqual(otherEnemyPos))
                    enemyBlocking = true;
            }
        }
    }

    //returns an array with the next dir and the diagonals
    function getPositionsToCheck(nextPos, thisEnemy) {

        var positions = [positionMap, nextPos]; //array container

        //then both diagonals
        positions.push(getDiagonal(1));
        positions.push(getDiagonal(-1));

        return positions;

        //calculates the diagonal by adding and then fixing
        function getDiagonal(parameter) {

            var diagonalDir = new Point(thisEnemy.dir.x, thisEnemy.dir.y)
                .add(parameter, parameter);

            if (diagonalDir.x % 2 === 0) diagonalDir.x = 0;
            if (diagonalDir.y % 2 === 0) diagonalDir.y = 0;

            return new Point(nextPos.x, nextPos.y)
                .add(diagonalDir.x, diagonalDir.y);
        }
    }

}

module.exports = Enemy;
