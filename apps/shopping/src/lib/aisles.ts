// Guesses which part of the shop an item is in, so the list reads in the
// order you walk round. First matching rule wins, which is why "lentil
// crisps" is checked as a snack before "lentil" as cupboard, and "fruit
// juice" as a drink before "fruit". The aisle can be changed on the item.
import type { Aisle } from "../types";
import { fold } from "./text";

const RULES: [Aisle, string[]][] = [
  // Phrases whose last word would otherwise send them to the wrong aisle.
  ["Cupboard", ["peanut butter", "almond butter", "coconut milk", "chicken stock", "beef stock", "veg stock", "vegetable stock", "stock cubes", "chopped tomatoes", "tinned tomatoes", "sun dried tomatoes"]],
  ["Snacks", ["crisps", "crisp", "popcorn", "crackers", "biscuits", "biscuit", "chocolate", "sweets", "protein bar", "cereal bar", "flapjack", "nuts", "peanuts", "cashews", "rice cakes", "pretzels", "nachos", "tortilla chips"]],
  ["Drinks", ["juice", "squash", "cordial", "water", "sparkling", "coke", "lemonade", "tea", "teabags", "tea bags", "coffee", "beer", "wine", "lager", "gin", "smoothie", "kombucha", "fizzy"]],
  ["Frozen", ["frozen", "ice cream", "ice", "peas", "chips", "fish fingers", "ice lollies"]],
  ["Household", ["bleach", "dishwasher", "washing up", "washing-up", "fairy", "detergent", "washing powder", "washing liquid", "laundry", "fabric conditioner", "softener", "bin bags", "bin liners", "kitchen roll", "kitchen towel", "foil", "cling film", "clingfilm", "baking paper", "sponges", "sponge", "cloths", "spray", "cleaner", "disinfectant", "toilet roll", "toilet rolls", "loo roll", "toilet paper", "tissues", "batteries", "light bulb", "bulbs", "zip bags", "freezer bags", "rinse aid", "salt for dishwasher", "dishwasher salt", "air freshener", "matches", "candles"]],
  ["Toiletries", ["shampoo", "conditioner", "shower gel", "body wash", "soap", "hand wash", "toothpaste", "toothbrush", "floss", "mouthwash", "deodorant", "razor", "razors", "shaving", "moisturiser", "sun cream", "suncream", "cotton buds", "plasters", "paracetamol", "ibuprofen", "vitamins"]],
  ["Herbs & spices", ["herbs", "basil", "parsley", "coriander", "mint", "thyme", "rosemary", "oregano", "dill", "chives", "sage", "bay leaves", "cumin", "paprika", "turmeric", "chilli flakes", "chilli powder", "cinnamon", "nutmeg", "curry powder", "garam masala", "mixed spice", "spice", "spices", "pepper", "peppercorns", "black pepper", "salt", "sea salt", "stock cubes", "stock", "gravy"]],
  ["Bread & bakery", ["bread", "loaf", "rolls", "baps", "bagels", "bagel", "wraps", "wrap", "tortillas", "flatbread", "flatbreads", "pitta", "pittas", "naan", "croissants", "crumpets", "muffins", "teacakes", "sourdough", "brioche", "pizza base", "pizza bases"]],
  ["Dairy & eggs", ["milk", "eggs", "egg", "butter", "cheese", "cheddar", "mozzarella", "parmesan", "parmigiano", "grana padano", "pecorino", "feta", "halloumi", "cottage cheese", "cream cheese", "philadelphia", "yogurt", "yoghurt", "skyr", "quark", "kefir", "cream", "creme fraiche", "custard", "margarine", "spread", "oat milk", "almond milk", "soya milk"]],
  ["Meat & fish", ["chicken", "beef", "mince", "steak", "pork", "bacon", "ham", "sausages", "sausage", "lamb", "turkey", "chorizo", "salami", "pepperoni", "salmon", "cod", "haddock", "prawns", "fish", "mackerel", "sea bass", "tofu", "quorn"]],
  ["Cupboard", ["tin", "tins", "tinned", "can of", "cans", "tuna", "chopped tomatoes", "passata", "tomato puree", "baked beans", "beans", "chickpeas", "lentils", "lentil", "rice", "pasta", "spaghetti", "noodles", "couscous", "quinoa", "oats", "porridge", "cereal", "granola", "flour", "sugar", "honey", "jam", "marmalade", "peanut butter", "nutella", "oil", "olive oil", "coconut oil", "vinegar", "soy sauce", "ketchup", "mayo", "mayonnaise", "mustard", "sauce", "pesto", "curry paste", "stock", "protein powder", "whey", "protein", "baking powder", "yeast", "coconut milk"]],
  ["Fruit & veg", ["onion", "onions", "carrot", "carrots", "potato", "potatoes", "sweet potato", "garlic", "ginger", "lemon", "lemons", "lime", "limes", "orange", "oranges", "apple", "apples", "banana", "bananas", "pear", "pears", "grapes", "berries", "strawberries", "raspberries", "blueberries", "melon", "pineapple", "mango", "avocado", "avocados", "tomato", "tomatoes", "cherry tomatoes", "cucumber", "lettuce", "salad", "spinach", "rocket", "kale", "cabbage", "broccoli", "cauliflower", "courgette", "courgettes", "aubergine", "peppers", "mushrooms", "celery", "leek", "leeks", "spring onions", "chilli", "chillies", "beetroot", "sweetcorn", "green beans", "fruit", "veg", "vegetables"]],
];

const COMPILED = RULES.map(([aisle, words]) => [aisle, new RegExp(`\\b(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`)] as const);

export function guessAisle(name: string): Aisle {
  const f = fold(name);
  for (const [aisle, re] of COMPILED) if (re.test(f)) return aisle;
  return "Other";
}
