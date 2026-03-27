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
A B
C

A -> B

Result:
B A
C

### 2

Start:
A B
C

B -> A

Result:
B A
C

### 3

Start:
A B
C

A -> C

Result:
C B
A

### 4

Start:
A B
C

C -> A

Result:
C B
A

### 5

Start:
A B
C

B -> C

Result:
A C
B

### 6

Start:
A B
C D

A -> D

Result:
D B
C A

### 7

Start:
A B
C D

D -> A

Result:
D B
C A

### 8

Start:
A B
C D

D -> A
B -> C

Result:
D C
B A

### 9

Start:
A A
B

A -> B

Result:
B
A A

### 10

Start:
A A
B

B ->| A>

Result:
A B

### 11

Start:
A A
B

B ->| <A

Result:
B A

### 12

Start:
A A A
B B

A -> B

Result:
B B
A A A

### 12

Start:
A A A
B B

B ->| A>

Result:
A B B

### 13

Start:
A B C
x D

D -> <D (dragging D to the left of itself so into the empty space)

Result:

A B C
D

### 14

Start:
A B C
x D

D -> D> (dragging D to the right of itself so into the empty space)

Result:

A B C
x x D

### 15

Start:
A A A
B

B ->| <A (dragging B to the left of A)

Result:
B A A
