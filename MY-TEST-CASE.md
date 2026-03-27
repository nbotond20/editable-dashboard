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

### 16

Start:
A B

A -> B

Result:
B A

### 17

Start:
A B
C D

A -> C

Result:
C B
A D

### 18

Start:
A B
C D

B -> D

Result:
A D
C B

### 19

Start:
A B
C D

B -> C

Result:
A C
B D

### 20

Start:
A A
B C

A -> B

Result:
B
A A
C

### 21

Start:
A A
B C

A -> C

Result:
C B
A A

### 22

Start:
A A
B C

B -> C

Result:
A A
C B

### 23

Start:
A A
B C

C ->| <A

Result:
C A
B

### 24

Start:
A A
B C

C ->| A>

Result:
A C
B

### 25

Start:
A A
B B

A -> B

Result:
B B
A A

### 26

Start:
A A
B B

B ->| A>

Result:
A B

### 27

Start:
A A
B B

B ->| <A

Result:
B A

### 28

Start:
A B C

A -> B

Result:
B A C

### 29

Start:
A B C

A -> C

Result:
C B A

### 30

Start:
A B C

B -> C

Result:
A C B

### 31

Start:
A B C
D

A -> D

Result:
D B C
A

### 32

Start:
A B C
D

C -> D

Result:
A B D
C

### 33

Start:
A B C
D E

A -> D

Result:
D B C
A E

### 34

Start:
A B C
D E

E -> B

Result:
A E C
D B

### 35

Start:
A B C
D E F

A -> F

Result:
F B C
D E A

### 36

Start:
A B C
D E F

A -> D

Result:
D B C
A E F

### 37

Start:
A B C
x D

A -> x1

Result:
B C
A D

### 38

Start:
A A B

A -> B

Result:
B A A

### 39

Start:
A A B
C

A -> C

Result:
C B
A A

### 40

Start:
A A B
C

B -> C

Result:
A A C
B

### 41

Start:
A B B

A -> B

Result:
B B A

### 42

Start:
A A A
B

A -> B

Result:
B
A A A

### 43

Start:
A A A
B

B ->| A>

Result:
A A B

### 44

Start:
A A A
B C

A -> B

Result:
B
A A A
C

### 45

Start:
A A A
B C

B -> C

Result:
A A A
C B

### 46

Start:
A A A
B C

B ->| <A

Result:
B A A
C

### 47

Start:
A A A
B C

C ->| A>

Result:
A A C
B

### 48

Start:
A A
B B

A -> B

Result:
B B
A A

### 49

Start:
A A
B B

B ->| A>

Result:
A B B

### 50

Start:
A A B
C C

A -> B

Result:
B A A
C C

### 51

Start:
A A B
C C

C -> A

Result:
C C B
A A

### 52

Start:
A A A
B B C

A -> B

Result:
B B
A A A
C

### 53

Start:
A A A
B B C

B -> C

Result:
A A A
C B B

### 54

Start:
A A A
B B C

C ->| A>

Result:
A A C
B B

### 55

Start:
A A A
B B

B ->| <A

Result:
B B A

### 56

Start:
A B C
D E F

A -> F
B -> E

Result:
F E C
D B A

### 57

Start:
A B
C D

A -> D
C -> B

Result:
D C
B A
