"use client";

import { useState, useEffect, useRef } from "react";
import {
  ref,
  set,
  onValue,
  push,
  get,
  DatabaseReference,
} from "firebase/database";
import { User } from "firebase/auth";
import { useRouter } from "next/navigation";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import SignatureCanvas from "react-signature-canvas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { database, auth } from "@/lib/firebase";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  timesPerWeek: number;
  completionDays: string[];
}

interface UserTodos {
  [userId: string]: {
    name: string;
    todos: Todo[];
    signature?: string;
  };
}

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTimesPerWeekChange: (id: string, times: number) => void;
  isEditable: boolean;
  contractSigned: boolean;
  userName: string;
}

const getWeekStart = () => {
  const now = new Date();
  const first = now.getDate() - now.getDay() + 1; // Adjusts for starting week on Monday
  return new Date(now.setDate(first));
};

const getCompletedThisWeek = (completionDays: string[]) => {
  const weekStart = getWeekStart().toISOString().split("T")[0];
  const now = new Date().toISOString().split("T")[0];
  return completionDays.filter((date) => date >= weekStart && date <= now)
    .length;
};

const getProgressColor = (progress: number) => {
  const r = Math.min(255, (255 * (100 - progress)) / 100);
  const g = Math.min(225, (255 * progress) / 100);
  return `rgba(${r}, ${g}, 0, 1)`;
};

const TodoList: React.FC<TodoListProps> = ({
  todos,
  onToggle,
  onDelete,
  onTimesPerWeekChange,
  isEditable,
  contractSigned,
  userName,
}) => (
  <div>
    <h3 className="text-xl font-semibold mb-2">{userName}'s To-Do List</h3>

    {todos.length === 0 && (
      <p className="text-sm text-gray-500">
        This slacker hasn't put any tasks in yet.
      </p>
    )}
    <ul className="space-y-2">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className="flex items-center space-x-2 justify-between"
        >
          {contractSigned && (
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => onToggle(todo.id)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={!contractSigned}
            />
          )}
          <span className={todo.completed ? "w-full line-through" : "w-full"}>
            {todo.text}
          </span>
          {isEditable && !contractSigned && (
            <>
              <select
                value={todo.timesPerWeek}
                onChange={(e) =>
                  onTimesPerWeekChange(todo.id, parseInt(e.target.value))
                }
              >
                {[...Array(8).keys()].map((n) => (
                  <option key={n} value={n}>
                    {n} times per week
                  </option>
                ))}
              </select>
              <button
                onClick={() => onDelete(todo.id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </>
          )}
          {!isEditable && !contractSigned && (
            <span className="w-full">{todo.timesPerWeek} times per week</span>
          )}
          {contractSigned && (
            <span className="w-full">
              {getCompletedThisWeek(todo.completionDays)} / {todo.timesPerWeek}{" "}
              times this week
            </span>
          )}
          <div
            style={{ width: 120 }}
            className="flex justify-center items-center"
          >
            <CircularProgressbar
              // className="w-60 h-60"
              styles={buildStyles({
                pathColor: getProgressColor(
                  Math.min(
                    (getCompletedThisWeek(todo.completionDays) /
                      todo.timesPerWeek) *
                      100,
                    100
                  )
                ),
              })}
              value={Math.min(
                (getCompletedThisWeek(todo.completionDays) /
                  todo.timesPerWeek) *
                  100,
                100
              )}
              text={`${Math.min(
                (getCompletedThisWeek(todo.completionDays) /
                  todo.timesPerWeek) *
                  100,
                100
              ).toFixed(0)}%`}
            />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

interface TodoContractProps {
  isBaseUrl?: boolean;
  contractId?: string;
}

export default function TodoContract({
  isBaseUrl = false,
  contractId: initialContractId,
}: TodoContractProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [contractId, setContractId] = useState<string | null>(
    initialContractId || null
  );
  const [userTodos, setUserTodos] = useState<UserTodos>({});
  const [newTodo, setNewTodo] = useState("");
  const [contractSigned, setContractSigned] = useState(false);
  const [punishment, setPunishment] = useState("");
  const [contractName, setContractName] = useState("");
  const [allContracts, setAllContracts] = useState<any[]>([]);
  const [endDate, setEndDate] = useState<string>(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString()
      .split("T")[0]
  );
  const [users, setUsers] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true); // Add this line

  const [weekLog, setWeekLog] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log(user, isBaseUrl, contractId);
    if (user) {
      if (isBaseUrl && !contractId) {
        const newContractRef = push(ref(database, "contracts"));
        setContractId(newContractRef.key);
      } else if (isBaseUrl) {
        const contractsRef = ref(database, "contracts");
        onValue(contractsRef, (snapshot) => {
          const data = snapshot.val();
          console.log(data);
          if (data) {
            const contractsArray = Object.entries(data).map(([key, value]) => ({
              id: key,
              ...value,
            }));
            setAllContracts(contractsArray);
          }
        });
      }
    }
  }, [user, isBaseUrl, contractId]);

  const updateEndDate = (date: string) => {
    if (contractId) {
      const endDateRef = ref(database, `contracts/${contractId}/endDate`);
      set(endDateRef, date);
    }
  };

  useEffect(() => {
    if (user && contractId) {
      const contractRef = ref(database, `contracts/${contractId}`);
      onValue(contractRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setContractName(data.name || "");
          setEndDate(
            data.endDate ||
              new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                .toISOString()
                .split("T")[0]
          );
          const updatedUserTodos: UserTodos = {};
          const userArray: any[] = []; // Initialize the user array

          Object.entries(data.users).forEach(
            ([userId, userData]: [string, any]) => {
              updatedUserTodos[userId] = {
                name: userData.name,
                todos: userData.todos
                  ? Object.entries(userData.todos).map(
                      ([todoId, todo]: [string, any]) => ({
                        id: todoId,
                        ...todo,
                        completionDays: todo.completionDays || [],
                      })
                    )
                  : [],
                signature: userData.signature || undefined,
              };
              userArray.push({ id: userId, ...userData }); // Push user data into the array
            }
          );
          setUserTodos(updatedUserTodos);
          setUsers(userArray); // Set the users state
        } else {
          setUserTodos({});
          setUsers([]); // Clear the users state if no data
        }
        setLoading(false); // Set loading to false after fetching data
      });

      const signedRef = ref(database, `contracts/${contractId}/signed`);
      onValue(signedRef, (snapshot) => {
        setContractSigned(snapshot.val() || false);
      });

      const punishmentRef = ref(database, `contracts/${contractId}/punishment`);
      onValue(punishmentRef, (snapshot) => {
        setPunishment(snapshot.val() || "");
      });

      const weekLogRef = ref(database, `contracts/${contractId}/weekLog`);
      onValue(weekLogRef, (snapshot) => {
        setWeekLog(snapshot.val() || []);
      });
    } else {
      setLoading(false);
    }
  }, [user, contractId]);

  const updateContractName = (name: string) => {
    if (contractId) {
      const contractNameRef = ref(database, `contracts/${contractId}/name`);
      set(contractNameRef, name);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const leaveContract = async () => {
    if (user && contractId) {
      const userRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}`
      );
      await set(userRef, null);
      setUserTodos((prevUserTodos) => {
        const updatedUserTodos = { ...prevUserTodos };
        delete updatedUserTodos[user.uid];
        return updatedUserTodos;
      });
      router.push("/"); // Redirect to the home page
    }
  };

  const addTodo = async () => {
    if (user && newTodo.trim() !== "" && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos`
      );
      const newTodoRef = push(todoRef); // This generates a unique key
      await set(newTodoRef, {
        id: newTodoRef.key, // Use the unique key as the ID
        text: newTodo,
        completed: false,
        timesPerWeek: 1,
        completionDays: [],
      });
      setNewTodo("");
    }
  };

  const toggleTodo = async (id: string) => {
    if (user && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos/${id}`
      );
      const snapshot = await get(todoRef);
      const todo = snapshot.val();
      if (todo) {
        const today = new Date().toISOString().split("T")[0];
        let completionDays = todo.completionDays || [];

        if (todo.completed) {
          completionDays = completionDays.filter((date) => date !== today);
        } else {
          if (!completionDays.includes(today)) {
            completionDays.push(today);
          }
        }

        await set(todoRef, {
          ...todo,
          completed: !todo.completed,
          completionDays,
        });
      }
    }
  };

  const deleteTodo = async (id: string) => {
    if (user && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos/${id}`
      );
      await set(todoRef, null);
    }
  };

  const signContract = async () => {
    if (user && contractId && sigCanvas.current) {
      if (Object.keys(userTodos).length < 2) {
        setErrorMessage(
          "You need at least two people in the contract to sign it."
        );
        return;
      }

      const signatureDataUrl = sigCanvas.current.toDataURL();
      const userRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}`
      );

      // Retain the existing todos structure
      const existingTodos = userTodos[user.uid].todos.reduce(
        (acc, todo) => ({
          ...acc,
          [todo.id]: {
            text: todo.text,
            completed: todo.completed,
            timesPerWeek: todo.timesPerWeek,
            completionDays: todo.completionDays,
          },
        }),
        {}
      );

      await set(userRef, {
        ...userTodos[user.uid],
        signature: signatureDataUrl,
        todos: existingTodos,
      });

      const newUserTodos = { ...userTodos };
      newUserTodos[user.uid].signature = signatureDataUrl;

      const allSigned = Object.values(newUserTodos).every(
        (userData) => userData.signature
      );
      if (allSigned) {
        const signedRef = ref(database, `contracts/${contractId}/signed`);
        await set(signedRef, true);
        setContractSigned(true);
        await sendContractSignedEmails();
      }
    }
  };

  const sendContractSignedEmails = async () => {
    if (contractId) {
      try {
        const response = await fetch("/api/sendContractSignedEmails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contractId, users: userTodos }),
        });

        if (!response.ok) {
          throw new Error("Failed to send emails");
        }
      } catch (error) {
        console.error("Error sending emails:", error);
      }
    }
  };

  const copyContractLink = () => {
    const link = `${window.location.origin}/contract/${contractId}`;
    navigator.clipboard.writeText(link);
    alert("Contract link copied to clipboard!");
  };

  const joinContract = async () => {
    if (user && contractId && !contractSigned) {
      const userRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}`
      );
      await set(userRef, { name: user.displayName || "Anonymous" });
    }
  };

  const onTimesPerWeekChange = async (id: string, times: number) => {
    if (user && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos/${id}`
      );
      const snapshot = await get(todoRef);
      const todo = snapshot.val();
      if (todo) {
        await set(todoRef, { ...todo, timesPerWeek: times });
      }
    }
  };

  const getProgressPercentage = (
    completionDays: string[],
    timesPerWeek: number
  ) => {
    const uniqueDays = [...new Set(completionDays)];
    const progress = Math.min((uniqueDays.length / timesPerWeek) * 100, 100);
    return progress;
  };

  const logWeeklyProgress = async () => {
    if (user && contractId) {
      const weekLogRef = ref(database, `contracts/${contractId}/weekLog`);
      const snapshot = await get(weekLogRef);
      const currentWeekLog = snapshot.val() || [];

      const newWeekLog = {
        week: new Date().toISOString().split("T")[0],
        users: userTodos,
      };

      await set(weekLogRef, [...currentWeekLog, newWeekLog]);

      // Reset weekly progress
      Object.keys(userTodos).forEach(async (userId) => {
        const userTodosRef = ref(
          database,
          `contracts/${contractId}/users/${userId}/todos`
        );
        Object.keys(userTodos[userId].todos).forEach(async (todoId) => {
          const todoRef = ref(
            database,
            `contracts/${contractId}/users/${userId}/todos/${todoId}`
          );
          const snapshot = await get(todoRef);
          const todo = snapshot.val();
          if (todo) {
            await set(todoRef, { ...todo, completionDays: [] });
          }
        });
      });
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        className="flex justify-center items-center w-full h-full min-h-screen"
      >
        <svg
          aria-hidden="true"
          className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill"
          />
        </svg>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl font-bold mb-4 mx-8">
          Welcome to Contractual Habits
        </h1>
        <b className="my-4 mx-12">
          One of your friends has invited you to join a contract to keep you
          accountable for reaching your goals, or else...
        </b>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>

        <p className="my-4 text-xs mx-8">
          To begin on your journey toward self-improvement, sign up above
        </p>
      </div>
    );
  }

  if (!contractId) {
    return <div>Loading contract...</div>;
  }

  if (isBaseUrl) {
    const userContracts = allContracts.filter(
      (contract) =>
        contract.users && Object.keys(contract.users).includes(user?.uid || "")
    );

    const otherContracts = allContracts.filter(
      (contract) =>
        contract.name &&
        contract.name.trim() !== "" &&
        !Object.keys(contract.users || {}).includes(user?.uid || "")
    );

    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="mt-4 mb-8 text-center text-3xl font-bold mb-4 w-full">
          Contractual Habits
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Create a New Contractual Habit</CardTitle>
            <CardDescription>
              Share this link with your partners
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Input
                type="text"
                value={`${window.location.origin}/contract/${contractId}`}
                readOnly
                className="flex-grow"
              />
              <Button onClick={copyContractLink}>Copy Link</Button>
            </div>
          </CardContent>
        </Card>
        {userContracts.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Your Contracts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="container mx-auto p-1 max-w-2xl">
                {userContracts.map((contract) => (
                  <Card key={contract.id} className="mb-4">
                    <CardHeader>
                      <CardTitle>{contract.name}</CardTitle>
                      <CardDescription>
                        Participants:{" "}
                        {Object.values(contract.users || {})
                          .map((user: any) => user.name)
                          .join(", ")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => router.push(`/contract/${contract.id}`)}
                      >
                        View Contract
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {otherContracts.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>
                Join Contracts in the Contractual Habits Community
              </CardTitle>
              <CardDescription>Join an existing contract</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="container mx-auto p-1 max-w-2xl">
                {otherContracts.map((contract) => (
                  <Card key={contract.id} className="mb-4">
                    <CardHeader>
                      <CardTitle>{contract.name}</CardTitle>
                      <CardDescription>
                        Participants:{" "}
                        {Object.values(contract.users || {})
                          .map((user: any) => user.name)
                          .join(", ")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => router.push(`/contract/${contract.id}`)}
                      >
                        View Contract
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // make sure not already in contract

  if (users && users.length < 1 && !users.find((u) => u.id === user.uid)) {
    joinContract();
  }

  if (!userTodos[user.uid]) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-center text-3xl font-bold mb-4 mt-4">
          Contractual Habits
        </h1>
        {/* this contract is between (show current members) */}
        <Card>
          <CardHeader>
            <CardTitle>Join the Contract</CardTitle>
            <CardDescription>Feel free to join this contract</CardDescription>
          </CardHeader>
        </Card>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Current Members</CardTitle>
            <CardDescription>
              The following people are already in this contract
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.values(userTodos)
              .map((user) => user.name)
              .join(", ")}
          </CardContent>
        </Card>
        <div className="flex items-center justify-center">
          <Button onClick={joinContract} className="mt-4">
            Join the Contract
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold mb-4 mt-4">Contractual Habits</h1>
        {/* link to home */}
        <Button onClick={() => router.push("/")}>Home</Button>
      </div>

      {!userTodos[user.uid] && !contractSigned && (
        <Button onClick={joinContract} className="mb-4">
          Join Contract
        </Button>
      )}

      {userTodos[user.uid] && !contractSigned && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Contract Name</CardTitle>
            <CardDescription>Set a name for this contract</CardDescription>
          </CardHeader>
          <CardContent>
            {!contractSigned ? (
              <Input
                type="text"
                value={contractName}
                onChange={(e) => {
                  setContractName(e.target.value);
                  updateContractName(e.target.value);
                }}
                placeholder="Enter contract name here"
                className="flex-grow"
              />
            ) : (
              <p>{contractName}</p>
            )}
          </CardContent>
        </Card>
      )}

      {contractSigned && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{contractName}</CardTitle>
            {/* display the names of everyone involved */}
            <CardDescription>
              The following are contractually obliged to complete their tasks:
            </CardDescription>
            <CardDescription>
              {Object.values(userTodos)
                .map((user) => user.name)
                .join(", ")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {userTodos[user.uid] && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>My To-Do List</CardTitle>
            <CardDescription>Add and manage your tasks here</CardDescription>
          </CardHeader>
          <CardContent>
            <TodoList
              todos={userTodos[user.uid].todos}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onTimesPerWeekChange={onTimesPerWeekChange}
              isEditable={true}
              contractSigned={contractSigned}
              userName={userTodos[user.uid].name}
            />
            {!contractSigned && (
              <div className="flex space-x-2 mt-4">
                <Input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  placeholder="Add a new todo"
                  className="flex-grow"
                />
                <Button onClick={addTodo}>Add</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {Object.entries(userTodos).map(
        ([userId, userData]) =>
          userId !== user.uid && (
            <Card key={userId} className="mb-4">
              <CardContent className="pt-4">
                <TodoList
                  todos={userData.todos}
                  onToggle={() => {}}
                  onDelete={() => {}}
                  onTimesPerWeekChange={() => {}}
                  isEditable={false}
                  contractSigned={contractSigned}
                  userName={userData.name}
                />
              </CardContent>
            </Card>
          )
      )}

      {userTodos[user.uid] && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Punishment</CardTitle>
            <CardDescription>
              What happens if you don't complete your tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!contractSigned ? (
              <Input
                type="text"
                value={punishment}
                onChange={(e) => {
                  if (user && contractId) {
                    const punishmentRef = ref(
                      database,
                      `contracts/${contractId}/punishment`
                    );
                    set(punishmentRef, e.target.value);
                  }
                }}
                placeholder="Enter punishment here"
                className="flex-grow"
              />
            ) : (
              <p>{punishment}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Contract End Date</CardTitle>
          <CardDescription>Set an end date for this contract</CardDescription>
        </CardHeader>
        <CardContent>
          {!contractSigned ? (
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                updateEndDate(e.target.value);
              }}
              className="flex-grow"
            />
          ) : (
            <p>{endDate}</p>
          )}
        </CardContent>
      </Card>

      {/* check if the contract has already been signed by any users yet */}
      {!contractSigned && (
        <>
          {Object.values(userTodos).some((user) => user.signature) && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Users Who Have Already Signed</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside">
                  {Object.values(userTodos)
                    .filter((user) => user.signature)
                    .map((user) => (
                      <li key={user.name}>{user.name}</li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {Object.values(userTodos).some((user) => !user.signature) && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Users Who Still Need to Sign</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside">
                  {Object.values(userTodos)
                    .filter((user) => !user.signature)
                    .map((user) => (
                      <li key={user.name}>{user.name}</li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <p className="mb-4 text-sm mx-4">
            By signing this contract, you are entering into a legally binding
            agreement with{" "}
            {Object.values(userTodos).length > 1
              ? Object.values(userTodos).map((user, index, array) => {
                  if (index === array.length - 1) return ` and ${user.name}`;
                  if (index === array.length - 2) return user.name;
                  return `${user.name}, `;
                })
              : Object.values(userTodos).map((user) => user.name)}
            . Once this contract is signed, you will be bound by its terms and
            conditions until its expiration date on {endDate}. Early termination
            of this contract is not permitted.
          </p>
        </>
      )}

      {errorMessage && (
        <div className="text-red-500 text-center mb-4">{errorMessage}</div>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="w-full"
            disabled={
              contractSigned ||
              (userTodos[user.uid] && userTodos[user.uid].signature)
            }
          >
            {contractSigned ? "Contract Signed" : "Sign Contract"}
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign the Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Please draw your signature below to sign the contract.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="border border-gray-300 rounded">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                width: 300,
                height: 200,
                className: "signature-canvas",
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={() => sigCanvas.current?.clear()}>
              Clear Signature
            </Button>
            <AlertDialogAction onClick={signContract}>
              Sign Contract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!contractSigned && (
        <Button
          onClick={leaveContract}
          className="w-full mt-4 bg-red-500 hover:bg-red-700 text-white"
        >
          Leave Contract
        </Button>
      )}

      {contractSigned && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Signatures</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start p-4 w-full">
            {Object.entries(userTodos).map(([userId, userData]) => (
              <div key={userId} className="mb-4 mx-4 flex flex-col">
                <p>{userData.name}</p>
                {userData.signature && (
                  <img
                    src={userData.signature}
                    alt={`${userData.name}'s signature`}
                    className="mt-4 w-48 h-24 border border-gray-300 rounded"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
