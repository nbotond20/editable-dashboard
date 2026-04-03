## Explanation:

### Positions

Letters are meant to represent widgets. If they are doubled that shows their col span. If they are on the same line that shows they are on the same row. If they are on different lines that shows they are on different rows.

A B C
D

This means we have 4 widgets, A, B, C, and D. A, B, and C are in the first row, and D is in the second row.

A A B
C

This means we have 3 widgets, one of which takes up the space of two widgets. A is the widget that takes up the space of two widgets, and B and C are the other two widgets.

x (small x marks an empty space that can be dragged into)

A B C
x D

### Actions

X -> Y means that X is dragged and dropped onto Y.
| holds the position of the dragged item while dragging.
< (left) and > (right) indicate the position of the dragged item before letting go (this calculated from the center of the stationary widget and the cursor).

examples:

Postions:
X Y

1, X -> Y means that X is dragged and dropped onto Y.
2, X ->| Y means that X is dragged and held onto Y before letting go.

X X
Y

3, Y ->| <X means that Y is dragged and held to the left of X before letting go.
4, Y ->| X> means that Y is dragged and held to the right of X before letting go.

### 1

Start:
A B C
D x1 x2

D -> x1

Result:
A B C
x1 D x2

### 2

Start:
A B C
D x1 x2

D -> x2

Result:
A B C
x1 x2 D

### 3

Start:
A A B
C D

D ->| <A

Result:
D A B
C

### 4

Start:
A A B
C D x

D -> x

Result:
A A B
C x D

### 5

Start:
A B C
x x D

D -> B

Result:
A D C
x x B

### 6

Start:
A B C
x x D

D ->| B

Result:
A D C
x x B

### 7

Start:
A B C
x x D

C -> B

Result:
A C B
x x D

### 8

Start:
A B C
x x D

A -> B

Result:
B A C
x x D

### 9

Start:
A B C
x x D

D -> D (dragging and dropping onto itself)

Result:
A B C
x x D

### 10

Start:
A B C
x x D

D ->| D (dragging and move it just a few pixels but within it's own space and dropping onto itself)

Result:
A B C
x x D

### 11

Start:
A A B
x C D

C Resize to 2 columns

Result:
A A B
C C D

### 12

Start:
A A B
x C D

C -> D

Result:
A A B
x D C

### 13

Start:
A A B
x C D

C ->| D

Result:
A A B
x D C

### 14

Start:
A B B
C x D

D resize to 2 columns

Result:
A B B
C D D

### 15

Start:
A B B
C D x

C resize to 2 columns

Result:
A B B
C C D

### 16

Start:
A B x1
C D D
x2 E

D ->| x1

Result:
A B D
C E

### 17

Start:
A B x1
C D D
x2 x3 E

E -> x1

Result:
A B E
C D D

### 18

Start:
A B x1
C D D
x2 x3 E

E ->| x1

Result:
A B E
C D D

### 19

Start:
A A
B C
D E

C ->| A>

Result:
A C
B D
E

### 19

Start:
A A B
C D E

E ->| A>

Result:
A E B
C D
