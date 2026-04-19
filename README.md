### Catching-Bones-Physics-Edition

This simple collection style game that demonstrates real physics concepts using falling bones on different planets. Each planet has its own gravity value derived from Newton's law of gravitation (g = GM/r²), so the bone falls at a different speed on every level.

#

### Game Requirements
This game:
- Includes a falling object sprite that falls from random positions during the game. 
- Includes a catcher sprite that moves left and right when the arrow keys are pressed. 
- Detects collision when the falling object collides with the catcher.
- Includes a score variable.
- Increases the score when the falling object collides with the catcher.
- Includes two or more images: one in the background, one for your catcher sprite, and one for your falling object sprite.

### Optional: Level + Extensions
You can extend your game further by:
- Trying a Spice Level Challenge
- Adding another falling object

###  Attributions
*Make sure images or resources are in the public domain, has a license that allows you to use it, or is one of your own.
- Dog 1 Image:
https://pixabay.com/
- Bone Image:
https://www.vecteezy.com/

---

## File Overview

### ← script.js

This is where we will add the JavaScript code for our game.

### ← assets

Drag in assets, like images, to add them to your project. If you are adding an image, it is best to save it to your computer, then upload the file to the `assets` folder. The url of the image will be `assets/example.jpg` or `assets/example.png`.

### ← index.html

The HTML file contains HTML code that sets up a webpage for our game. We also add libraries in this file using HTML tags.

### ← README.md

That's this file. This is the place to tell people more about what the game does and how you built it. 

### ← style.css

The CSS file adds styling rules to your content like changing colors and fonts. For this game, the CSS file was only used the screen display margin. Instead you can update the style of the game in the script.js file.  


---

### Physics concepts shown:

- Newton's 2nd Law: F = m * a

- Kinematics: v = u + a*t  (velocity builds each frame)

- Inelastic bounce: v_after = -e * v_before  (energy lost on impact)

- Orbital gravity: g = GM / r²  (each planet's real surface gravity)

### Planet Data

- Each planet has a real surface gravity g (m/s²). The formula g = GM/r² comes from Newton's law of gravitation: G = gravitational constant  (6.674 × 10⁻¹¹ N·m²/kg²), M = planet mass (kg), r = planet radius (m)
- A larger or denser planet has stronger g, so the bone falls faster.

---

### Software Used:
- Replit
