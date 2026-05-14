// seed.ts
import { db } from "./db";

const quotes: { title: string; body: string }[] = [
  {
    title: "On simplicity",
    body: "Simplicity is the ultimate sophistication. — Leonardo da Vinci",
  },
  {
    title: "On action",
    body: "The journey of a thousand miles begins with one step. — Lao Tzu",
  },
  {
    title: "On groceries",
    body: "Buy milk, eggs, bread, and apples. Do not forget the coffee.",
  },
  {
    title: "On failure",
    body: "I have not failed. I've just found 10,000 ways that won't work. — Thomas Edison",
  },
  {
    title: "On reading",
    body: "A reader lives a thousand lives before he dies. — George R.R. Martin",
  },
  {
    title: "On rocket boots",
    body: "Note to self: rocket boots are still a bad idea on stairs.",
  },
  {
    title: "On time",
    body: "Time you enjoy wasting is not wasted time. — Marthe Troly-Curtin",
  },
  {
    title: "On curiosity",
    body: "I have no special talent. I am only passionately curious. — Albert Einstein",
  },
  {
    title: "On more groceries",
    body: "Run out of oats again. Add to next list. Also peanut butter.",
  },
  {
    title: "On change",
    body: "Be the change that you wish to see in the world. — Mahatma Gandhi",
  },
  {
    title: "On dreams",
    body: "All our dreams can come true, if we have the courage to pursue them. — Walt Disney",
  },
  {
    title: "On work",
    body: "The only way to do great work is to love what you do. — Steve Jobs",
  },
  {
    title: "On taxes",
    body: "Quarterly estimate due April 15. Set reminder two weeks before.",
  },
  {
    title: "On listening",
    body: "Most people do not listen with the intent to understand; they listen with the intent to reply. — Stephen Covey",
  },
  {
    title: "On the rocket project",
    body: "Prototype thrust test scheduled for Saturday. Bring safety glasses.",
  },
  {
    title: "On honesty",
    body: "Honesty is the first chapter in the book of wisdom. — Thomas Jefferson",
  },
  {
    title: "On the garden",
    body: "Tomatoes need staking. Basil is doing fine. Mint is taking over.",
  },
  {
    title: "On patience",
    body: "Patience is bitter, but its fruit is sweet. — Jean-Jacques Rousseau",
  },
  {
    title: "On running",
    body: "Five miles at an easy pace. Felt good. Knee held up.",
  },
  {
    title: "On music",
    body: "Without music, life would be a mistake. — Friedrich Nietzsche",
  },
  {
    title: "On the bookshelf",
    body: "Need to reorganize. Three stacks on the floor again.",
  },
  {
    title: "On opportunity",
    body: "Opportunity is missed by most people because it is dressed in overalls and looks like work. — Thomas Edison",
  },
  {
    title: "On the kitchen",
    body: "Replace the dish sponge. Pick up new mop heads.",
  },
  {
    title: "On thinking",
    body: "Whenever you find yourself on the side of the majority, it is time to pause and reflect. — Mark Twain",
  },
  {
    title: "On the dog",
    body: "Vet appointment next Tuesday at 2pm. Bring stool sample.",
  },
  {
    title: "On courage",
    body: "Courage is grace under pressure. — Ernest Hemingway",
  },
  {
    title: "On the car",
    body: "Oil change due. Tire rotation soon. Check brake pads.",
  },
  {
    title: "On wisdom",
    body: "The only true wisdom is in knowing you know nothing. — Socrates",
  },
  {
    title: "On photography",
    body: "Charge the camera battery. Pack the 35mm lens for the weekend trip.",
  },
  {
    title: "On laughter",
    body: "A day without laughter is a day wasted. — Charlie Chaplin",
  },
  {
    title: "On the rocket fuel",
    body: "Solid fuel formulation needs rework. Burns too fast at the throat.",
  },
  {
    title: "On kindness",
    body: "No act of kindness, no matter how small, is ever wasted. — Aesop",
  },
  {
    title: "On the basement",
    body: "Boxes from the move are still there. Pick one weekend to deal with it.",
  },
  {
    title: "On persistence",
    body: "Fall seven times, stand up eight. — Japanese proverb",
  },
  {
    title: "On the kids",
    body: "Parent-teacher conference Thursday at 4. School play next Friday.",
  },
  {
    title: "On knowledge",
    body: "The more I read, the more I acquire, the more certain I am that I know nothing. — Voltaire",
  },
  {
    title: "On the back porch",
    body: "Stain the railing before winter. Buy weatherproofing sealant.",
  },
  {
    title: "On friendship",
    body: "A friend is someone who knows all about you and still loves you. — Elbert Hubbard",
  },
  {
    title: "On the bike",
    body: "Chain needs cleaning. Rear tire pressure low. Get a new helmet by spring.",
  },
  {
    title: "On peace",
    body: "Peace cannot be kept by force; it can only be achieved by understanding. — Albert Einstein",
  },
  {
    title: "On the office",
    body: "Standing desk arrives Monday. Move the monitor stand to the corner.",
  },
  {
    title: "On creativity",
    body: "Creativity is intelligence having fun. — Albert Einstein",
  },
  {
    title: "On the trip",
    body: "Book the cabin for the second week of June. Two nights minimum.",
  },
  {
    title: "On gratitude",
    body: "Gratitude turns what we have into enough. — Aesop",
  },
  {
    title: "On the budget",
    body: "Eating out is up 40% this quarter. Cap it at $200 next month.",
  },
  {
    title: "On learning",
    body: "Live as if you were to die tomorrow. Learn as if you were to live forever. — Mahatma Gandhi",
  },
  {
    title: "On the haircut",
    body: "Schedule one for next Wednesday. Same place as last time.",
  },
  {
    title: "On hope",
    body: "Hope is the thing with feathers that perches in the soul. — Emily Dickinson",
  },
  {
    title: "On the bookshelf again",
    body: "Donate the duplicates. Two copies of the same novel is two too many.",
  },
  {
    title: "On the rocket launch",
    body: "Test flight cleared for next month. Weather window is the limiting factor.",
  },
];

if (quotes.length !== 50) {
  console.error(`Expected 50 quotes, found ${quotes.length}`);
  process.exit(1);
}

console.log("Wiping notes table...");
db.run("DELETE FROM notes");

const insertNote = db.prepare(
  "INSERT INTO notes (user_id, title, body) VALUES (?, ?, ?)",
);

console.log("Inserting 50 notes for user_id=1...");
for (const q of quotes) {
  insertNote.run(1, q.title, q.body);
}

const count = db
  .query("SELECT COUNT(*) AS n FROM notes WHERE user_id = ?")
  .get(1) as { n: number };
console.log(`Done. ${count.n} notes in the database for user_id=1.`);
